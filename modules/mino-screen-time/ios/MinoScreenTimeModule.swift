import ExpoModulesCore
import FamilyControls
import ManagedSettings
import DeviceActivity
import SwiftUI

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

  public func definition() -> ModuleDefinition {
    Name("MinoScreenTime")

    // ------------------------------------------------------ autorisation

    AsyncFunction("authorizationStatus") { () -> String in
      Self.describe(AuthorizationCenter.shared.authorizationStatus)
    }

    AsyncFunction("requestAuthorization") { () async throws -> String in
      // `.child` et non `.individual` : c'est le parent qui autorise Mino à
      // encadrer l'appareil d'un enfant, et iOS demande alors le code Temps
      // d'écran du parent. C'est ce qui empêche un enfant de s'auto-libérer.
      do {
        try await AuthorizationCenter.shared.requestAuthorization(for: .child)
      } catch {
        // Un refus n'est pas une panne : l'écran de réglage doit pouvoir
        // l'afficher calmement, pas planter.
        return Self.describe(AuthorizationCenter.shared.authorizationStatus)
      }
      return Self.describe(AuthorizationCenter.shared.authorizationStatus)
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

    AsyncFunction("unshield") { (until: Double) in
      // Rien à lever si l'échéance est déjà passée : mieux vaut ne rien faire
      // que d'ouvrir pour une durée nulle et laisser le bouclier tombé.
      let deadline = Date(timeIntervalSince1970: until / 1000)
      guard deadline > Date().addingTimeInterval(60) else { return }

      self.store.shield.applications = nil
      self.store.shield.applicationCategories = nil
      self.shared?.set(deadline.timeIntervalSince1970, forKey: Self.deadlineKey)

      // L'extension se réveille à la fin de l'intervalle et repose le bouclier,
      // que Mino soit ouvert, fermé ou tué.
      let calendar = Calendar.current
      let schedule = DeviceActivitySchedule(
        intervalStart: calendar.dateComponents([.hour, .minute, .second], from: Date()),
        intervalEnd: calendar.dateComponents([.hour, .minute, .second], from: deadline),
        repeats: false
      )
      let center = DeviceActivityCenter()
      center.stopMonitoring([Self.activityName])
      try? center.startMonitoring(Self.activityName, during: schedule)
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
