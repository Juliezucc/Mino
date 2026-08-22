package app.mino.screentime

import android.app.AppOpsManager
import android.content.Context
import android.content.Intent
import android.os.Process
import android.provider.Settings
import androidx.core.content.edit
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

/**
 * Le bouclier, côté Android — et il ne ressemble en rien à celui d'iOS.
 *
 * Android n'a pas d'équivalent de FamilyControls : aucune API ne permet à une
 * application d'en empêcher une autre de s'ouvrir. Ce qu'on peut faire, et que
 * font toutes les applications de contrôle parental du marché, tient en deux
 * autorisations que le parent accorde explicitement dans les réglages du
 * système :
 *
 *   - PACKAGE_USAGE_STATS : savoir quelle application est au premier plan.
 *   - SYSTEM_ALERT_WINDOW : afficher un écran par-dessus.
 *
 * Le service `ShieldWatcher` regarde ce qui passe au premier plan et, si c'est
 * une application encadrée pendant que le bouclier est levé, pose un écran
 * Mino par-dessus. Ce n'est pas un blocage au sens strict — c'est un rappel
 * qu'on ne peut pas ignorer, et c'est le maximum que le système autorise.
 *
 * DEUX HONNÊTETÉS À TENIR, et elles sont écrites ici pour qu'on ne les oublie
 * pas au moment de rédiger la fiche Play :
 *
 *   1. Un adolescent déterminé contourne : il désactive l'accès aux statistiques
 *      d'usage. On ne peut pas l'en empêcher, on peut seulement le rendre
 *      visible au parent — c'est ce que fait `authorizationStatus`, qui repasse
 *      à « denied » et fait réapparaître l'écran de réglage.
 *   2. La sélection d'applications, ici, est un vrai choix de noms de paquets :
 *      contrairement à iOS, Mino VOIT ce qui est installé. Le sélecteur ne
 *      remonte donc jamais la liste au serveur, et elle reste sur l'appareil.
 */
class MinoScreenTimeModule : Module() {
  private val context: Context
    get() = requireNotNull(appContext.reactContext)

  private val prefs
    get() = context.getSharedPreferences("mino.shield", Context.MODE_PRIVATE)

  override fun definition() = ModuleDefinition {
    Name("MinoScreenTime")

    // ------------------------------------------------------ autorisation

    AsyncFunction("authorizationStatus") {
      if (hasUsageAccess() && Settings.canDrawOverlays(context)) "approved" else "denied"
    }

    AsyncFunction("requestAuthorization") {
      // Android ne permet pas de demander ces deux droits par une boîte de
      // dialogue : il faut ouvrir les réglages et laisser le parent basculer
      // l'interrupteur. On ouvre donc celui qui manque, et l'écran de réglage
      // de Mino relira le statut au retour.
      if (!hasUsageAccess()) {
        context.startActivity(
          Intent(Settings.ACTION_USAGE_ACCESS_SETTINGS).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        )
      } else if (!Settings.canDrawOverlays(context)) {
        context.startActivity(
          Intent(Settings.ACTION_MANAGE_OVERLAY_PERMISSION).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        )
      }
      if (hasUsageAccess() && Settings.canDrawOverlays(context)) "approved" else "not-determined"
    }

    // ---------------------------------------------------------- sélection

    AsyncFunction("presentPicker") {
      context.startActivity(
        Intent(context, PickerActivity::class.java).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
      )
      // Le sélecteur est une activité : elle écrit la sélection en sortant, et
      // l'écran de réglage relit le compte au retour. On rend donc ce qu'on
      // sait à l'instant, pas ce que le parent va choisir.
      mapOf("count" to shielded().size)
    }

    AsyncFunction("selectionCount") { mapOf("count" to shielded().size) }

    // ------------------------------------------------------------ bouclier

    AsyncFunction("shield") {
      prefs.edit { remove(DEADLINE) }
      ShieldWatcher.start(context)
    }

    AsyncFunction("unshield") { until: Double ->
      val deadline = until.toLong()
      if (deadline > System.currentTimeMillis() + 60_000) {
        prefs.edit { putLong(DEADLINE, deadline) }
        // Le service continue de tourner : c'est LUI qui reposera le bouclier à
        // l'échéance, y compris si Mino a été balayé hors de l'écran. Le
        // service redémarre au démarrage du téléphone (voir le manifeste).
        ShieldWatcher.start(context)
      }
    }

    AsyncFunction("remaining") {
      val deadline = prefs.getLong(DEADLINE, 0L)
      val reste = deadline - System.currentTimeMillis()
      if (reste > 0) reste.toDouble() else 0.0
    }
  }

  private fun shielded(): Set<String> = prefs.getStringSet(PACKAGES, emptySet()) ?: emptySet()

  private fun hasUsageAccess(): Boolean {
    val ops = context.getSystemService(Context.APP_OPS_SERVICE) as AppOpsManager
    val mode = ops.unsafeCheckOpNoThrow(
      AppOpsManager.OPSTR_GET_USAGE_STATS,
      Process.myUid(),
      context.packageName
    )
    return mode == AppOpsManager.MODE_ALLOWED
  }

  companion object {
    const val PACKAGES = "mino.packages"
    const val DEADLINE = "mino.deadline"
  }
}
