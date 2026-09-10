package app.mino.screentime

import android.app.AppOpsManager
import android.content.Context
import android.content.Intent
import android.os.Build
import android.os.Process
import android.os.SystemClock
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
      prefs.edit { remove(DEADLINE); remove(DEADLINE_MONOTONE) }
      ShieldWatcher.start(context)
    }

    AsyncFunction("unshield") { until: Double ->
      val deadline = until.toLong()
      val reste = deadline - System.currentTimeMillis()
      if (reste > 60_000) {
        prefs.edit {
          putLong(DEADLINE, deadline)
          // La même échéance, mesurée à l'horloge monotone. Voir `echue()` :
          // c'est ce qui empêche de rallonger une session en reculant l'heure.
          putLong(DEADLINE_MONOTONE, SystemClock.elapsedRealtime() + reste)
        }
        // Le service continue de tourner : c'est LUI qui reposera le bouclier à
        // l'échéance, y compris si Mino a été balayé hors de l'écran. Et
        // `BootReceiver` le relance après un redémarrage.
        ShieldWatcher.start(context)
      }
    }

    AsyncFunction("remaining") {
      val reste = restant(prefs)
      if (reste > 0) reste.toDouble() else 0.0
    }
  }

  private fun shielded(): Set<String> = prefs.getStringSet(PACKAGES, emptySet()) ?: emptySet()

  /**
   * L'accès aux statistiques d'usage — et la méthode qui n'existe pas partout.
   *
   * **Le défaut que cela répare, trouvé sur une tablette Samsung.**
   * `unsafeCheckOpNoThrow` n'est apparue qu'avec Android 10 (API 29). Sur tout
   * appareil plus ancien, l'appel ne rate pas à la compilation — il rate à
   * l'exécution, avec un `NoSuchMethodError` que l'application affichait tel
   * quel au parent :
   *
   *     java.lang.NoSuchMethodError: No virtual method
   *     unsafeCheckOpNoThrow(…) in class Landroid/app/AppOpsManager
   *
   * Autrement dit, le bouclier était purement et simplement indisponible sur
   * une grande part du parc Android — et les tablettes, précisément celles
   * qu'on donne aux enfants, sont les appareils qui restent le plus longtemps
   * sur une vieille version.
   *
   * `checkOpNoThrow` fait la même chose, existe depuis Android 4.4, et n'est
   * dépréciée que depuis l'arrivée de l'autre. On garde donc les deux, chacune
   * là où elle existe.
   */
  private fun hasUsageAccess(): Boolean {
    val ops = context.getSystemService(Context.APP_OPS_SERVICE) as? AppOpsManager ?: return false
    val mode = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
      ops.unsafeCheckOpNoThrow(
        AppOpsManager.OPSTR_GET_USAGE_STATS,
        Process.myUid(),
        context.packageName
      )
    } else {
      @Suppress("DEPRECATION")
      ops.checkOpNoThrow(
        AppOpsManager.OPSTR_GET_USAGE_STATS,
        Process.myUid(),
        context.packageName
      )
    }
    return mode == AppOpsManager.MODE_ALLOWED
  }

  companion object {
    const val PACKAGES = "mino.packages"
    const val DEADLINE = "mino.deadline"
    const val DEADLINE_MONOTONE = "mino.deadline.monotone"

    /**
     * Ce qui reste de la session, en millisecondes — et pourquoi deux horloges.
     *
     * `System.currentTimeMillis()` est l'heure du téléphone, et l'heure du
     * téléphone se règle. Reculer l'horloge de deux heures rallongeait la
     * session de deux heures : le contournement le plus simple qui soit, à la
     * portée de n'importe quel enfant qui sait ouvrir les réglages.
     *
     * `SystemClock.elapsedRealtime()` compte depuis le démarrage et ne se règle
     * pas. Elle a un seul défaut, qui est de repartir de zéro au redémarrage —
     * et c'est exactement le bon défaut : après un redémarrage l'échéance
     * monotone est forcément dans le futur, donc elle ne dit plus rien, et on
     * retombe sur l'horloge murale. Le reste du temps, elle a le dernier mot.
     *
     * On prend donc la plus courte des deux. Reculer l'heure ne donne plus une
     * minute. L'avancer termine la session plus tôt — c'est perdant pour
     * l'enfant, et on n'a rien à corriger là.
     */
    fun restant(prefs: android.content.SharedPreferences): Long {
      val mur = prefs.getLong(DEADLINE, 0L)
      if (mur == 0L) return 0L
      val resteMur = mur - System.currentTimeMillis()

      val monotone = prefs.getLong(DEADLINE_MONOTONE, 0L)
      if (monotone == 0L) return resteMur
      val resteMonotone = monotone - SystemClock.elapsedRealtime()

      return minOf(resteMur, resteMonotone)
    }

    /** `true` quand la session est finie, quelle que soit l'horloge consultée. */
    fun echue(prefs: android.content.SharedPreferences): Boolean = restant(prefs) <= 0L
  }
}
