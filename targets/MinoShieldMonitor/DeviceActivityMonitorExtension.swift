import DeviceActivity
import FamilyControls
import ManagedSettings
import Foundation

/**
 Ce qui repose le bouclier quand Mino n'est plus là.

 **CE FICHIER NE FAIT PAS PARTIE DE L'APPLICATION.** Il est compilé dans une
 cible d'extension distincte, `MinoShieldMonitor`, décrite juste à côté dans
 `expo-target.config.js`. Compilé dans l'application, il ne serait jamais
 réveillé par le système — et le bouclier ne reviendrait jamais tout seul,
 c'est-à-dire que le produit ne tiendrait pas sa seule promesse.

 **Le nom de la classe n'est pas libre.** L'`Info.plist` d'une extension
 *Device Activity Monitor* désigne sa classe principale par
 `$(PRODUCT_MODULE_NAME).DeviceActivityMonitorExtension`. La renommer, c'est
 obtenir une extension que le système installe, planifie, réveille — et qui ne
 trouve rien à exécuter.

 Pourquoi une extension et pas un minuteur dans l'application : un enfant qui
 balaie Mino hors de l'écran, ou un iPhone qui met l'application en veille,
 suffiraient à laisser le bouclier à terre indéfiniment. Le système, lui,
 réveille l'extension à l'heure dite, sans réseau et sans nous.

 L'extension ne partage avec l'application que deux choses, par le groupe
 `group.fr.minoapp.mino` : la sélection d'applications, et le magasin de
 réglages `mino.shield`. Elle ne sait rien du reste, et n'a besoin de rien
 d'autre.
 */
class DeviceActivityMonitorExtension: DeviceActivityMonitor {
  private let store = ManagedSettingsStore(named: .init("mino.shield"))
  private static let appGroup = "group.fr.minoapp.mino"
  private static let selectionKey = "mino.selection"
  private static let deadlineKey = "mino.deadline"

  override func intervalDidEnd(for activity: DeviceActivityName) {
    super.intervalDidEnd(for: activity)
    reshield()
  }

  /**
   Le rappel des séances courtes, et la raison pour laquelle elles existent.

   `DeviceActivity` refuse tout intervalle de moins de quinze minutes. Or une
   séance de cinq minutes est exactement ce que Mino vend. L'application
   programme donc un intervalle d'un quart d'heure et demande un
   AVERTISSEMENT placé à l'heure réelle : c'est ici qu'il tombe, et c'est ici
   que le bouclier revient pour une séance courte.

   `intervalDidEnd` repose de toute façon, un peu plus tard. Ce n'est pas une
   redondance inutile : si l'avertissement manquait, l'enfant garderait dix
   minutes de trop — pas toutes.
   */
  override func intervalWillEndWarning(for activity: DeviceActivityName) {
    super.intervalWillEndWarning(for: activity)
    reshield()
  }

  /// Ceinture et bretelles : si le système annule l'intervalle pour une raison
  /// qui lui appartient, on repose quand même. Une session qui se termine mal
  /// doit se terminer fermée, jamais ouverte.
  override func eventDidReachThreshold(
    _ event: DeviceActivityEvent.Name,
    activity: DeviceActivityName
  ) {
    super.eventDidReachThreshold(event, activity: activity)
    reshield()
  }

  private func reshield() {
    let defaults = UserDefaults(suiteName: Self.appGroup)
    defaults?.removeObject(forKey: Self.deadlineKey)

    guard
      let data = defaults?.data(forKey: Self.selectionKey),
      let selection = try? JSONDecoder().decode(FamilyActivitySelection.self, from: data)
    else {
      // Pas de sélection lisible : on ne devine pas. Reposer un bouclier vide
      // ne bloquerait rien, mais inventer une liste bloquerait n'importe quoi.
      return
    }

    store.shield.applications = selection.applicationTokens.isEmpty
      ? nil
      : selection.applicationTokens
    store.shield.applicationCategories = selection.categoryTokens.isEmpty
      ? nil
      : .specific(selection.categoryTokens)
  }
}
