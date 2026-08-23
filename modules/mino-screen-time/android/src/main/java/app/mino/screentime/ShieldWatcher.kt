package app.mino.screentime

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.Service
import android.app.usage.UsageStatsManager
import android.content.Context
import android.content.Intent
import android.graphics.PixelFormat
import android.os.Build
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import android.provider.Settings
import android.view.Gravity
import android.view.WindowManager
import android.widget.FrameLayout
import androidx.core.content.edit

/**
 * Ce qui regarde ce qui passe au premier plan.
 *
 * Un service au premier plan, avec sa notification permanente : Android tue
 * sans état d'âme un service d'arrière-plan, et un bouclier qui s'éteint tout
 * seul ne bloque rien. La notification n'est donc pas une politesse, c'est ce
 * qui maintient le service en vie — et le système l'exige, ce qui est très
 * bien : un parent doit voir que Mino surveille, et l'enfant aussi.
 *
 * La boucle est volontairement lente — une seconde. Plus vite ne bloquerait pas
 * mieux (le temps de réaction perçu est le même) et viderait la batterie, ce
 * qui est la première raison pour laquelle un parent désinstalle ce genre
 * d'application.
 */
class ShieldWatcher : Service() {
  private val handler = Handler(Looper.getMainLooper())
  private var overlay: FrameLayout? = null

  private val prefs by lazy { getSharedPreferences("mino.shield", Context.MODE_PRIVATE) }

  private val boucle = object : Runnable {
    override fun run() {
      verifier()
      handler.postDelayed(this, 1_000)
    }
  }

  override fun onBind(intent: Intent?): IBinder? = null

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    startForeground(NOTIFICATION_ID, notification())
    handler.removeCallbacks(boucle)
    handler.post(boucle)
    // `START_STICKY` : si Android nous tue pour récupérer de la mémoire, il
    // nous relance. Sans cela, une session finie pendant un pic de mémoire
    // laisserait le bouclier à terre jusqu'à la prochaine ouverture de Mino.
    return START_STICKY
  }

  override fun onDestroy() {
    handler.removeCallbacks(boucle)
    retirerOverlay()
    super.onDestroy()
  }

  private fun verifier() {
    val deadline = prefs.getLong(MinoScreenTimeModule.DEADLINE, 0L)
    val leve = deadline != 0L && !MinoScreenTimeModule.echue(prefs)

    // L'échéance vient de passer : on nettoie, pour que `remaining()` dise la
    // vérité et que l'écran parent ne montre pas une session finie.
    if (!leve && deadline != 0L) {
      prefs.edit {
        remove(MinoScreenTimeModule.DEADLINE)
        remove(MinoScreenTimeModule.DEADLINE_MONOTONE)
      }
    }

    if (leve) {
      retirerOverlay()
      return
    }

    val paquet = auPremierPlan()

    // MINO NE SE BOUCLE JAMAIS LUI-MÊME. Sur iOS, le système s'en charge : une
    // application autorisée par FamilyControls est exemptée d'office, y compris
    // quand le parent coche une catégorie entière. Android n'offre aucune
    // garantie de ce genre — c'est à nous de la tenir.
    //
    // Le sélecteur écarte déjà Mino de la liste, mais le sélecteur n'est pas
    // l'endroit où le dégât se produit : c'est ici. Une préférence héritée
    // d'une version antérieure, une restauration de sauvegarde, une faute de
    // frappe dans une migration, et l'écran se poserait par-dessus Mino. Un
    // enfant ne pourrait alors plus déclarer une mission, donc plus jamais
    // gagner de temps, donc plus jamais lever le bouclier — et l'écran qui
    // permet de tout défaire serait précisément derrière l'écran. Sans issue,
    // sur l'appareil de l'enfant.
    //
    // Une ligne, à l'endroit où elle ne peut pas être contournée.
    //
    // LE TÉLÉPHONE NON PLUS, et pour une raison qui n'a rien à voir avec le
    // confort : un enfant doit pouvoir appeler. Aucun temps d'écran mérité ne
    // vaut un écran posé par-dessus un appel au 15. Le sélecteur ne propose
    // déjà pas le composeur ; ici on refuse de le recouvrir même si son nom
    // arrivait dans la liste par un autre chemin.
    if (paquet == packageName || paquet == composeur()) {
      retirerOverlay()
      return
    }

    val encadrees = prefs.getStringSet(MinoScreenTimeModule.PACKAGES, emptySet()) ?: emptySet()
    if (paquet != null && encadrees.contains(paquet)) poserOverlay() else retirerOverlay()
  }

  /**
   * Le composeur par défaut du téléphone, s'il y en a un.
   *
   * `TelecomManager.getDefaultDialerPackage()` rend celui que l'utilisateur a
   * choisi, et non celui du constructeur : sur un appareil où le parent a
   * installé un autre composeur, c'est bien celui-là qu'il faut épargner. Une
   * tablette sans téléphonie ne rend rien, et il n'y a alors rien à épargner.
   */
  private fun composeur(): String? = runCatching {
    (getSystemService(Context.TELECOM_SERVICE) as android.telecom.TelecomManager)
      .defaultDialerPackage
  }.getOrNull()

  /** Ce qui est au premier plan, d'après les statistiques d'usage du système. */
  private fun auPremierPlan(): String? {
    val usage = getSystemService(Context.USAGE_STATS_SERVICE) as UsageStatsManager
    val maintenant = System.currentTimeMillis()
    val stats = usage.queryUsageStats(
      UsageStatsManager.INTERVAL_DAILY,
      maintenant - 10_000,
      maintenant
    ) ?: return null
    return stats.maxByOrNull { it.lastTimeUsed }?.packageName
  }

  private fun poserOverlay() {
    if (overlay != null) return
    if (!Settings.canDrawOverlays(this)) return

    val vue = FrameLayout(this)
    vue.setBackgroundColor(0xF21A1D2E.toInt()) // navy Mino, presque opaque
    val params = WindowManager.LayoutParams(
      WindowManager.LayoutParams.MATCH_PARENT,
      WindowManager.LayoutParams.MATCH_PARENT,
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O)
        WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY
      else
        @Suppress("DEPRECATION") WindowManager.LayoutParams.TYPE_PHONE,
      WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE or
        WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN,
      PixelFormat.TRANSLUCENT
    )
    params.gravity = Gravity.CENTER

    (getSystemService(Context.WINDOW_SERVICE) as WindowManager).addView(vue, params)
    overlay = vue
  }

  private fun retirerOverlay() {
    val vue = overlay ?: return
    runCatching {
      (getSystemService(Context.WINDOW_SERVICE) as WindowManager).removeView(vue)
    }
    overlay = null
  }

  private fun notification(): Notification {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      val canal = NotificationChannel(
        CHANNEL,
        "Temps d’écran",
        // IMPORTANCE_LOW : présente, mais sans son ni bandeau. Elle doit se
        // voir dans le tiroir, pas interrompre.
        NotificationManager.IMPORTANCE_LOW
      )
      (getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager)
        .createNotificationChannel(canal)
    }
    return Notification.Builder(this, CHANNEL)
      .setContentTitle("Mino veille sur le temps d’écran")
      .setContentText("Les applications encadrées s’ouvrent avec le temps gagné.")
      .setSmallIcon(android.R.drawable.ic_lock_idle_lock)
      .setOngoing(true)
      .build()
  }

  companion object {
    private const val CHANNEL = "mino.shield"
    private const val NOTIFICATION_ID = 4231

    fun start(context: Context) {
      val intent = Intent(context, ShieldWatcher::class.java)
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
        context.startForegroundService(intent)
      } else {
        context.startService(intent)
      }
    }
  }
}
