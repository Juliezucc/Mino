import DeviceActivity
import FamilyControls
import ManagedSettings
import Foundation

/**
 Ce qui repose le bouclier quand Mino n'est plus là.

 **CE FICHIER NE FAIT PAS PARTIE DE L'APPLICATION.** Il doit être compilé dans
 une CIBLE D'EXTENSION distincte, de type *Device Activity Monitor Extension*,
 nommée `MinoShieldMonitor`. Laissé dans la cible principale, il ne sera jamais
 réveillé et le bouclier ne reviendra jamais tout seul — c'est-à-dire que le
 produit ne tiendra pas sa seule promesse.

 Voir `docs/blocage-ecrans.md` pour la marche à suivre dans Xcode.

 Pourquoi une extension et pas un minuteur dans l'application : un enfant qui
 balaie Mino hors de l'écran, ou un iPhone qui met l'application en veille,
 suffiraient à laisser le bouclier à terre indéfiniment. Le système, lui,
 réveille l'extension à l'heure dite, sans réseau et sans nous.

 L'extension ne partage avec l'application que deux choses, par le groupe
 `group.fr.minoapp.mino` : la sélection d'applications, et le magasin de
 réglages `mino.shield`. Elle ne sait rien du reste, et n'a besoin de rien
 d'autre.
 */
class MinoShieldMonitor: DeviceActivityMonitor {
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
