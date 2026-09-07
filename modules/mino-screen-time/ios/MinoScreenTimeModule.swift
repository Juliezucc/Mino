import ExpoModulesCore
import FamilyControls
import ManagedSettings
import DeviceActivity
import SwiftUI
import UIKit

/**
 Le bouclier, et rien d'autre.

 Ce module ne connaît ni mission, ni minute gagnée, ni famille : il pose un
 bouclier sur des applications que le parent a choisies, le lève pour une durée,
 et le repose. Tout le reste — qui a gagné quoi, et combien — est décidé côté
 JavaScript, où c'est testable.

 CE QUE MINO NE VOIT JAMAIS. `FamilyActivitySelection` ne contient pas des noms
 d'applications mais des jetons opaques, chiffrés par le système. Mino ne peut
 donc pas savoir que l'enfant a TikTok, ni le dire à qui que ce soit : c'est une
 garantie d'Apple, pas une promesse de notre part. C'est aussi la raison pour
 laquelle le sélecteur est celui du système et pas le nôtre.

 LE POINT DÉLICAT, et il n'est pas dans ce fichier : reposer le bouclier à
 l'échéance alors que Mino n'est pas ouvert. Un enfant qui tue l'application ne
 doit pas gagner du temps illimité. C'est `DeviceActivityMonitor` qui s'en
 charge, dans une extension séparée (`MinoShieldMonitor`), réveillée par le
 système à l'heure dite. `unshield` prend donc une ÉCHÉANCE et non une durée :
 l'extension doit pouvoir agir seule, sans réseau et sans nous.
 */
public class MinoScreenTimeModule: Module {
  /// Le magasin de réglages gérés. Un nom fixe : l'extension doit ouvrir le même.
  private let store = ManagedSettingsStore(named: .init("mino.shield"))

  /// Là où l'extension va lire la sélection et l'échéance. Le groupe
  /// d'applications est ce qui rend la mémoire commune à l'app et à l'extension.
  private var shared: UserDefaults? {
    UserDefaults(suiteName: MinoScreenTimeModule.appGroup)
  }

  static let appGroup = "group.fr.minoapp.mino"
  private static let selectionKey = "mino.selection"
  private static let deadlineKey = "mino.deadline"
  private static let activityName = DeviceActivityName("mino.session")

  /// Le plancher qu'impose `DeviceActivity` à tout intervalle surveillé.
  /// Quinze minutes, et il n'est pas négociable — voir `unshield`.
  private static let plancherIntervalle: TimeInterval = 15 * 60

  public func definition() -> ModuleDefinition {
    Name("MinoScreenTime")

    // ------------------------------------------------------ autorisation

    AsyncFunction("authorizationStatus") { () -> String in
      Self.describe(AuthorizationCenter.shared.authorizationStatus)
    }

    /**
     Demander l'autorisation — et dire ce qui s'est passé quand elle est refusée.

     **Le silence était le défaut.** Toute erreur d'iOS était avalée et la
     fonction rendait le statut inchangé. À l'écran, cela donnait un bouton sur
     lequel on appuie et où rien ne se passe : ni fenêtre système, ni message, ni
     moyen de savoir si le refus venait d'Apple, du compte, ou d'un défaut de
     Mino. Un parent aurait désinstallé là.

     **Pourquoi deux tentatives.** `.child` est le bon mode : c'est le parent qui
     autorise Mino à encadrer l'appareil d'un enfant, iOS réclame alors le code
     Temps d'écran, et l'enfant ne peut pas révoquer ce qu'il n'a pas accordé.
     Mais iOS le refuse quand le compte Apple de l'appareil n'est **pas un compte
     enfant** d'un groupe Partage familial — le cas de l'iPhone d'un parent qui
     essaie, et surtout celui d'un adolescent qui a son propre identifiant.

     `.individual` fonctionne alors : le titulaire de l'appareil s'encadre
     lui-même. C'est plus faible — il peut le retirer dans les réglages — mais
     c'est la différence entre un produit qui protège moins et un produit qui ne
     fait rien du tout. `authorizationStatus` repasse à « denied » s'il le
     retire, et l'écran de réglage le redit au parent.
     */
    AsyncFunction("requestAuthorization") { () async throws -> String in
      do {
        try await AuthorizationCenter.shared.requestAuthorization(for: .child)
        return Self.describe(AuthorizationCenter.shared.authorizationStatus)
      } catch {
        let premier = error

        do {
          try await AuthorizationCenter.shared.requestAuthorization(for: .individual)
          return Self.describe(AuthorizationCenter.shared.authorizationStatus)
        } catch {
          // Refusé des deux façons. Si le système a tout de même accordé
          // quelque chose entre-temps, c'est lui qui a raison.
          let statut = AuthorizationCenter.shared.authorizationStatus
          if statut == .approved { return Self.describe(statut) }

          // On remonte la PREMIÈRE erreur : c'est celle du mode qu'on voulait,
          // et c'est elle qui explique pourquoi on a dû se rabattre.
          throw AutorisationRefusee(premier.localizedDescription)
        }
      }
    }

    // ---------------------------------------------------------- sélection

    AsyncFunction("presentPicker") { () async throws -> [String: Int] in
      let selection = try await Self.presentPicker(current: self.loadSelection())
      self.saveSelection(selection)
      // Choisir, c'est déjà protéger : le bouclier se pose tout de suite, sans
      // quoi il y aurait une fenêtre où le parent croit avoir réglé et où rien
      // n'est en place.
      self.applyShield(selection)
      return ["count": Self.count(of: selection)]
    }

    AsyncFunction("selectionCount") { () -> [String: Int] in
      ["count": Self.count(of: self.loadSelection())]
    }

    // ------------------------------------------------------------ bouclier

    AsyncFunction("shield") { () in
      self.applyShield(self.loadSelection())
      self.shared?.removeObject(forKey: Self.deadlineKey)
      DeviceActivityCenter().stopMonitoring([Self.activityName])
    }

    /**
     Lever le bouclier pour une durée — et surtout, garantir son retour.

     DEUX RÈGLES SONT NÉES D'UN DÉFAUT, et elles sont l'essentiel de cette
     fonction.

     **1. On programme le retour AVANT de lever.** L'ordre inverse paraît
     naturel et il est catastrophique : si le système refuse la programmation,
     le bouclier est déjà à terre et plus rien ne le relève. L'enfant obtient un
     téléphone ouvert pour toujours, et l'application continue d'afficher son
     minuteur comme si de rien n'était.

     **2. `DeviceActivity` refuse tout intervalle de moins de quinze minutes**
     (`MonitoringError.intervalTooShort`). Or Mino vend des séances de cinq
     minutes — c'est même le cœur du produit : un enfant qui a sept minos doit
     pouvoir en dépenser sept. Une séance courte était donc programmée, refusée,
     l'erreur avalée par un `try?`, et le bouclier ne revenait jamais.

     Le remède est celui qu'Apple indique lui-même dans la suggestion attachée à
     cette erreur : l'intervalle dure le plancher de quinze minutes, et c'est
     l'AVERTISSEMENT (`warningTime`) qui tombe à l'heure réelle. L'extension
     repose le bouclier là. Et si l'avertissement manquait, la fin d'intervalle
     le repose de toute façon : au pire l'enfant garde dix minutes de trop, au
     lieu de les garder toutes.
     */
    AsyncFunction("unshield") { (until: Double) in
      // Rien à lever si l'échéance est déjà passée : mieux vaut ne rien faire
      // que d'ouvrir pour une durée nulle et laisser le bouclier tombé.
      let deadline = Date(timeIntervalSince1970: until / 1000)
      let debut = Date()
      guard deadline > debut.addingTimeInterval(60) else { return }

      let duree = deadline.timeIntervalSince(debut)
      let courte = duree < Self.plancherIntervalle
      let fin = courte ? debut.addingTimeInterval(Self.plancherIntervalle) : deadline

      let calendar = Calendar.current
      let schedule = DeviceActivitySchedule(
        intervalStart: calendar.dateComponents([.hour, .minute, .second], from: debut),
        intervalEnd: calendar.dateComponents([.hour, .minute, .second], from: fin),
        repeats: false,
        // Compté depuis la FIN de l'intervalle : pour une séance de cinq
        // minutes, dix minutes d'avertissement placent le rappel à la
        // cinquième. Pour une séance assez longue, pas d'avertissement du tout.
        warningTime: courte
          ? Self.composantes(of: Self.plancherIntervalle - duree)
          : nil
      )

      let center = DeviceActivityCenter()
      center.stopMonitoring([Self.activityName])
      do {
        try center.startMonitoring(Self.activityName, during: schedule)
      } catch {
        // Le bouclier n'a pas bougé : on ne lève rien, et l'application
        // l'apprend au lieu de croire la séance ouverte.
        throw ProgrammationRefusee(error.localizedDescription)
      }

      // Et seulement maintenant.
      self.store.shield.applications = nil
      self.store.shield.applicationCategories = nil
      self.shared?.set(deadline.timeIntervalSince1970, forKey: Self.deadlineKey)
    }

    AsyncFunction("remaining") { () -> Double in
      guard let epoch = self.shared?.object(forKey: Self.deadlineKey) as? Double else { return 0 }
      let reste = Date(timeIntervalSince1970: epoch).timeIntervalSinceNow
      return reste > 0 ? reste * 1000 : 0
    }
  }

  // ------------------------------------------------------------- interne

  private func applyShield(_ selection: FamilyActivitySelection) {
    store.shield.applications = selection.applicationTokens.isEmpty
      ? nil
      : selection.applicationTokens
    store.shield.applicationCategories = selection.categoryTokens.isEmpty
      ? nil
      : .specific(selection.categoryTokens)
  }

  private func loadSelection() -> FamilyActivitySelection {
    guard
      let data = shared?.data(forKey: Self.selectionKey),
      let selection = try? JSONDecoder().decode(FamilyActivitySelection.self, from: data)
    else { return FamilyActivitySelection() }
    return selection
  }

  private func saveSelection(_ selection: FamilyActivitySelection) {
    guard let data = try? JSONEncoder().encode(selection) else { return }
    shared?.set(data, forKey: Self.selectionKey)
  }

  private static func count(of selection: FamilyActivitySelection) -> Int {
    selection.applicationTokens.count + selection.categoryTokens.count
  }

  /// Une durée, exprimée comme `DeviceActivitySchedule` attend son
  /// avertissement : des composantes de calendrier, et non des secondes.
  private static func composantes(of duree: TimeInterval) -> DateComponents {
    let secondes = max(1, Int(duree.rounded()))
    return DateComponents(minute: secondes / 60, second: secondes % 60)
  }

  private static func describe(_ status: AuthorizationStatus) -> String {
    switch status {
    case .approved: return "approved"
    case .denied: return "denied"
    case .notDetermined: return "not-determined"
    @unknown default: return "not-determined"
    }
  }

  /// Le sélecteur d'Apple, présenté par-dessus l'écran courant.
  ///
  /// `FamilyActivityPicker` est du SwiftUI : il faut donc l'envelopper dans un
  /// `UIHostingController` et le présenter à la main. On rend la sélection au
  /// moment où le parent ferme la feuille — un « Terminé » qui ne rendrait rien
  /// laisserait l'écran de réglage attendre indéfiniment.
  @MainActor
  private static func presentPicker(
    current: FamilyActivitySelection
  ) async throws -> FamilyActivitySelection {
    try await withCheckedThrowingContinuation { continuation in
      guard
        let scene = UIApplication.shared.connectedScenes.first as? UIWindowScene,
        let root = scene.windows.first(where: { $0.isKeyWindow })?.rootViewController
      else {
        continuation.resume(returning: current)
        return
      }

      let model = PickerModel(selection: current)
      var hosting: UIHostingController<PickerView>?
      let view = PickerView(model: model) { chosen in
        hosting?.dismiss(animated: true)
        continuation.resume(returning: chosen)
      }
      let controller = UIHostingController(rootView: view)
      hosting = controller
      root.present(controller, animated: true)
    }
  }
}

/**
 Le système a refusé de programmer le retour du bouclier.

 Elle remonte jusqu'au JavaScript, qui annule alors la séance : mieux vaut un
 enfant qui lit « impossible de démarrer » qu'un enfant débité de ses minutes
 devant des applications restées fermées — ou, pire, ouvertes pour toujours.
 */
/**
 Ce qu'iOS a répondu quand il a refusé l'autorisation.

 Le message vient d'Apple, pas de nous, et c'est voulu : il nomme la vraie cause
 — compte qui n'est pas un compte enfant, Temps d'écran désactivé, restriction
 posée par un autre outil de gestion. Le réécrire reviendrait à choisir une
 explication au hasard parmi celles-là.
 */
private final class AutorisationRefusee: GenericException<String> {
  override var reason: String {
    "iOS a refusé l’autorisation : \(param)"
  }
}

private final class ProgrammationRefusee: GenericException<String> {
  override var reason: String {
    "Le système a refusé de programmer le retour du blocage : \(param)"
  }
}

private final class PickerModel: ObservableObject {
  @Published var selection: FamilyActivitySelection
  init(selection: FamilyActivitySelection) { self.selection = selection }
}

private struct PickerView: View {
  @ObservedObject var model: PickerModel
  let done: (FamilyActivitySelection) -> Void

  var body: some View {
    NavigationView {
      FamilyActivityPicker(selection: $model.selection)
        .navigationTitle("Applications à encadrer")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
          ToolbarItem(placement: .confirmationAction) {
            Button("Terminé") { done(model.selection) }
          }
        }
    }
  }
}
