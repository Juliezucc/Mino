package app.mino.screentime

import android.app.Activity
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Bundle
import android.widget.ArrayAdapter
import android.widget.ListView
import androidx.core.content.edit

/**
 * Le sélecteur d'applications, côté Android.
 *
 * Contrairement à iOS, où le système présente sa propre liste et ne nous montre
 * que des jetons opaques, Android nous laisse lire ce qui est installé. C'est
 * une responsabilité et non une commodité : la liste ne quitte jamais
 * l'appareil, ne part dans aucune requête, et n'est écrite que dans les
 * préférences locales du module.
 *
 * On ne montre que les applications lançables, et on écarte Mino lui-même —
 * un bouclier qui recouvre Mino empêcherait l'enfant de gagner du temps, ce qui
 * serait à la fois absurde et sans issue.
 */
class PickerActivity : Activity() {
  override fun onCreate(saved: Bundle?) {
    super.onCreate(saved)

    val pm = packageManager
    val lancables = pm.queryIntentActivities(
      Intent(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_LAUNCHER),
      0
    )
      .map { it.activityInfo.packageName }
      .distinct()
      .filter { it != packageName }
      .map { it to (nomLisible(pm, it) ?: it) }
      .sortedBy { it.second.lowercase() }

    val prefs = getSharedPreferences("mino.shield", MODE_PRIVATE)
    val deja = prefs.getStringSet(MinoScreenTimeModule.PACKAGES, emptySet()) ?: emptySet()

    val liste = ListView(this)
    liste.choiceMode = ListView.CHOICE_MODE_MULTIPLE
    liste.adapter = ArrayAdapter(
      this,
      android.R.layout.simple_list_item_multiple_choice,
      lancables.map { it.second }
    )
    lancables.forEachIndexed { i, (paquet, _) ->
      if (deja.contains(paquet)) liste.setItemChecked(i, true)
    }

    setContentView(liste)

    // La sélection s'enregistre en sortant : pas de bouton « Terminé » à
    // manquer, et le geste « retour » d'Android fait exactement ce qu'on
    // attend de lui.
    onBackPressedDispatcher.addCallback(this, object : androidx.activity.OnBackPressedCallback(true) {
      override fun handleOnBackPressed() {
        val choisis = lancables
          .filterIndexed { i, _ -> liste.isItemChecked(i) }
          .map { it.first }
          .toSet()
        prefs.edit { putStringSet(MinoScreenTimeModule.PACKAGES, choisis) }
        ShieldWatcher.start(this@PickerActivity)
        finish()
      }
    })
  }

  private fun nomLisible(pm: PackageManager, paquet: String): String? = runCatching {
    pm.getApplicationLabel(pm.getApplicationInfo(paquet, 0)).toString()
  }.getOrNull()
}
