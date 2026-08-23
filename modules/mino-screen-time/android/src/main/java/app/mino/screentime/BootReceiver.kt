package app.mino.screentime

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent

/**
 * Relancer le bouclier après un redémarrage.
 *
 * Ce fichier n'existait pas, et son absence était un contournement complet :
 * le manifeste demandait bien `RECEIVE_BOOT_COMPLETED`, `ShieldWatcher`
 * affirmait en commentaire que « le service redémarre au démarrage du
 * téléphone (voir le manifeste) », et personne n'écoutait. Un enfant qui
 * éteignait puis rallumait son téléphone n'avait plus aucun bouclier jusqu'à
 * la prochaine ouverture de Mino — c'est-à-dire jamais, puisqu'il n'avait plus
 * aucune raison de l'ouvrir.
 *
 * Un contournement à la portée d'un enfant de six ans est un contournement
 * qu'il faut supposer connu de tous les enfants.
 *
 * `QUICKBOOT_POWERON` en plus de `BOOT_COMPLETED` : plusieurs constructeurs —
 * HTC et une partie des appareils chinois — n'émettent que le premier quand le
 * téléphone sort d'un arrêt rapide.
 */
class BootReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent) {
    when (intent.action) {
      Intent.ACTION_BOOT_COMPLETED,
      Intent.ACTION_LOCKED_BOOT_COMPLETED,
      "android.intent.action.QUICKBOOT_POWERON" -> {
        // On ne redémarre le veilleur que si le parent a réellement choisi des
        // applications : sur un appareil de parent, ou avant tout réglage,
        // faire tourner un service au premier plan avec sa notification
        // permanente serait une nuisance sans objet.
        val prefs = context.getSharedPreferences("mino.shield", Context.MODE_PRIVATE)
        val encadrees = prefs.getStringSet(MinoScreenTimeModule.PACKAGES, emptySet())
        if (!encadrees.isNullOrEmpty()) ShieldWatcher.start(context)
      }
    }
  }
}
