package app.mino.screentime

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.Service
import android.app.usage.UsageEvents
import android.app.usage.UsageStatsManager
import android.content.Context
import android.content.Intent
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.graphics.PixelFormat
import android.graphics.RectF
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.os.Build
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import android.provider.Settings
import android.view.Gravity
import android.view.View
import android.view.WindowManager
import android.widget.FrameLayout
import android.widget.LinearLayout
import android.widget.ScrollView
import android.widget.TextView
import androidx.core.app.NotificationCompat
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

  /**
   * Ce qui est au premier plan — par les ÉVÉNEMENTS, pas par les statistiques.
   *
   * La version précédente demandait `queryUsageStats` sur les dix dernières
   * secondes et gardait l'application au `lastTimeUsed` le plus récent. C'est le
   * raccourci qu'on trouve partout, et il a deux défauts qu'on ne voit qu'à
   * l'usage : `queryUsageStats` rend des seaux **agrégés** — sur un intervalle
   * de dix secondes, Android rend en réalité le seau du jour entier — et
   * `lastTimeUsed` n'est pas rafraîchi à la seconde, ni de la même façon selon
   * le constructeur. Le bouclier arrivait donc avec plusieurs secondes de
   * retard, et sur certains appareils pas du tout.
   *
   * `queryEvents` dit exactement ce qui est passé au premier plan et à quelle
   * milliseconde. On lit les événements survenus **depuis la lecture
   * précédente** — une seconde de données à chaque tour, rien de plus — et on
   * garde le dernier connu entre deux tours : un enfant qui reste dix minutes
   * dans la même application ne produit aucun événement, et c'est normal.
   *
   * Le repli sur les statistiques ne sert qu'au tout premier tour, quand on
   * n'a encore rien vu passer.
   */
  private var dernierPaquet: String? = null
  private var derniereLecture = 0L

  private fun auPremierPlan(): String? {
    val usage = getSystemService(Context.USAGE_STATS_SERVICE) as UsageStatsManager
    val maintenant = System.currentTimeMillis()
    // `coerceIn` : l'horloge du téléphone se règle, et une borne de départ
    // postérieure à la borne d'arrivée rendrait une liste vide pour toujours.
    val depuis = (if (derniereLecture == 0L) maintenant - 60_000 else derniereLecture)
      .coerceIn(maintenant - 60_000, maintenant)

    val evenements = usage.queryEvents(depuis, maintenant)
    val evenement = UsageEvents.Event()
    while (evenements.hasNextEvent()) {
      evenements.getNextEvent(evenement)
      // `MOVE_TO_FOREGROUND` plutôt que `ACTIVITY_RESUMED`, qui porte la même
      // valeur mais n'existe qu'à partir d'Android 10. Le module descend à 24.
      @Suppress("DEPRECATION")
      if (evenement.eventType == UsageEvents.Event.MOVE_TO_FOREGROUND) {
        dernierPaquet = evenement.packageName
      }
    }
    derniereLecture = maintenant

    if (dernierPaquet != null) return dernierPaquet

    val stats = usage.queryUsageStats(
      UsageStatsManager.INTERVAL_DAILY,
      maintenant - 10_000,
      maintenant
    ) ?: return null
    return stats.maxByOrNull { it.lastTimeUsed }?.packageName
  }

  /**
   * L'écran que voit l'enfant, et ce qu'il a le droit de lui dire.
   *
   * C'était un rectangle bleu nuit **vide** : aucun texte, aucune image, aucune
   * sortie. Un enfant de cinq ans touchait YouTube et recevait un carré sombre
   * sans explication, sur l'appareil que ses parents lui ont confié.
   *
   * **CE QUE CET ÉCRAN NE PEUT PAS SAVOIR, et qui décide de tout ce qu'il
   * écrit.** Le bouclier est posé dès qu'aucune séance ne tourne — ce qui n'est
   * pas du tout la même chose que « l'enfant n'a plus de temps ». Un enfant
   * avec quarante minos en réserve, qui n'a simplement pas encore lancé sa
   * séance, voit exactement cet écran-là. Lui annoncer « ton temps est
   * terminé » serait donc faux une fois sur deux, et faux au pire moment :
   * celui où il a mérité son temps et où on lui dit qu'il n'en a plus.
   *
   * Le module ne connaît pas le solde — il ne connaît qu'une échéance. Tout ce
   * qui est écrit ici doit donc rester vrai dans les deux cas, et c'est ce qui
   * a dicté chaque mot : ouvrir Mino est la bonne action qu'on ait du temps à
   * lancer ou une mission à faire.
   */
  private fun poserOverlay() {
    if (overlay != null) return
    if (!Settings.canDrawOverlays(this)) return

    val vue = FrameLayout(this).apply {
      setBackgroundColor(Color.argb(242, 26, 29, 46)) // navy Mino, presque opaque
      // Toute la surface absorbe les touches : rien ne passe au travers, et
      // seul le bouton déclenche quelque chose.
      isClickable = true
    }

    val carte = LinearLayout(this).apply {
      orientation = LinearLayout.VERTICAL
      gravity = Gravity.CENTER_HORIZONTAL
      setPadding(dp(28), dp(28), dp(28), dp(26))
      background = fondArrondi(Color.WHITE, 32f)
      elevation = dp(4).toFloat()
    }

    carte.addView(
      MinoTempsEcouleView(this).apply {
        contentDescription = "Mino attend que tu ouvres l’application"
      },
      LinearLayout.LayoutParams(dp(190), dp(190)).apply {
        gravity = Gravity.CENTER_HORIZONTAL
        bottomMargin = dp(22)
      }
    )

    carte.addView(
      TextView(this).apply {
        text = "Ouvre Mino d’abord"
        setTextColor(Color.rgb(26, 29, 46))
        textSize = 27f
        gravity = Gravity.CENTER
        typeface = Typeface.create(Typeface.DEFAULT, Typeface.BOLD)
        includeFontPadding = false
      },
      LinearLayout.LayoutParams(
        LinearLayout.LayoutParams.MATCH_PARENT,
        LinearLayout.LayoutParams.WRAP_CONTENT
      )
    )

    carte.addView(
      TextView(this).apply {
        // Vraie dans les deux cas : du temps à lancer, ou une mission à faire.
        text = "Tu pourras lancer ton temps, ou faire une mission pour en gagner."
        setTextColor(Color.rgb(77, 82, 105))
        textSize = 17f
        gravity = Gravity.CENTER
        includeFontPadding = false
        setLineSpacing(0f, 1.12f)
      },
      LinearLayout.LayoutParams(
        LinearLayout.LayoutParams.MATCH_PARENT,
        LinearLayout.LayoutParams.WRAP_CONTENT
      ).apply {
        topMargin = dp(14)
        leftMargin = dp(6)
        rightMargin = dp(6)
      }
    )

    carte.addView(View(this), LinearLayout.LayoutParams(1, dp(24)))

    carte.addView(
      TextView(this).apply {
        text = "Ouvrir Mino"
        setTextColor(Color.WHITE)
        textSize = 18f
        gravity = Gravity.CENTER
        typeface = Typeface.create(Typeface.DEFAULT, Typeface.BOLD)
        setPadding(dp(20), dp(16), dp(20), dp(16))
        background = fondArrondi(Color.rgb(78, 182, 255), 22f)
        isClickable = true
        isFocusable = true
        contentDescription = "Ouvrir Mino"
        setOnClickListener { ouvrirMino() }
      },
      // 64 dp : au-dessus des 56 dp de l'écran enfant, parce que c'est la
      // seule sortie et qu'elle doit se toucher du premier coup.
      LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, dp(64))
    )

    carte.addView(
      TextView(this).apply {
        text = "Grandir, une mission à la fois."
        setTextColor(Color.rgb(122, 124, 255))
        textSize = 14f
        gravity = Gravity.CENTER
        typeface = Typeface.create(Typeface.DEFAULT, Typeface.BOLD)
        includeFontPadding = false
      },
      LinearLayout.LayoutParams(
        LinearLayout.LayoutParams.MATCH_PARENT,
        LinearLayout.LayoutParams.WRAP_CONTENT
      ).apply { topMargin = dp(20) }
    )

    /**
     * La carte défile, et ce n'est pas une précaution de confort.
     *
     * Elle mesure près de 500 dp. En paysage, ou avec la taille de police
     * poussée à 200 % dans les réglages d'accessibilité, elle dépasse l'écran —
     * et ce qui déborde par le bas, c'est le bouton. Autrement dit : le seul
     * moyen de sortir, hors de portée, sur l'appareil d'un enfant.
     */
    val defilement = ScrollView(this).apply {
      isFillViewport = false
      overScrollMode = View.OVER_SCROLL_NEVER
      clipToPadding = false
      addView(
        carte,
        FrameLayout.LayoutParams(
          FrameLayout.LayoutParams.MATCH_PARENT,
          FrameLayout.LayoutParams.WRAP_CONTENT
        )
      )
    }

    vue.addView(
      defilement,
      FrameLayout.LayoutParams(
        FrameLayout.LayoutParams.MATCH_PARENT,
        FrameLayout.LayoutParams.WRAP_CONTENT
      ).apply {
        gravity = Gravity.CENTER
        leftMargin = dp(24)
        rightMargin = dp(24)
        topMargin = dp(40)
        bottomMargin = dp(40)
      }
    )

    val params = WindowManager.LayoutParams(
      WindowManager.LayoutParams.MATCH_PARENT,
      WindowManager.LayoutParams.MATCH_PARENT,
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O)
        WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY
      else
        @Suppress("DEPRECATION") WindowManager.LayoutParams.TYPE_PHONE,
      // `FLAG_NOT_FOCUSABLE` empêche la fenêtre de prendre le focus clavier,
      // pas de recevoir les touches : le bouton et le défilement répondent.
      WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE or
        WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN,
      PixelFormat.TRANSLUCENT
    )
    params.gravity = Gravity.CENTER

    (getSystemService(Context.WINDOW_SERVICE) as WindowManager).addView(vue, params)
    overlay = vue
  }

  /**
   * Ouvrir Mino — la seule sortie, et elle ne s'ouvre qu'en cas de succès.
   *
   * Retirer l'écran avant de savoir si Mino s'est lancé rendrait l'application
   * encadrée accessible pour rien. `verifier()` le retirerait de toute façon au
   * tour suivant, puisque Mino est explicitement épargné ; le faire ici évite
   * seulement une seconde d'écran inutile.
   */
  private fun ouvrirMino() {
    val lancement = packageManager.getLaunchIntentForPackage(packageName) ?: return
    lancement.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP)
    runCatching { startActivity(lancement) }.onSuccess { retirerOverlay() }
  }

  /** Un fond plein très arrondi, sans passer par `res/`. */
  private fun fondArrondi(couleur: Int, rayonDp: Float): GradientDrawable =
    GradientDrawable().apply {
      shape = GradientDrawable.RECTANGLE
      setColor(couleur)
      cornerRadius = rayonDp * resources.displayMetrics.density
    }

  private fun dp(valeur: Int): Int =
    (valeur * resources.displayMetrics.density + 0.5f).toInt()

  private fun retirerOverlay() {
    val vue = overlay ?: return
    runCatching {
      (getSystemService(Context.WINDOW_SERVICE) as WindowManager).removeView(vue)
    }
    overlay = null
  }

  /**
   * La notification qui maintient le service en vie.
   *
   * `NotificationCompat` et non `Notification.Builder` : le constructeur qui
   * prend un identifiant de canal n'existe qu'à partir d'Android 8, alors que
   * le module descend à Android 7. Sur un appareil en 7, ce service plantait au
   * démarrage — et un service qui ne démarre pas est un bouclier qui ne se lève
   * jamais, sur l'appareil d'un enfant, sans que rien ne le signale au parent.
   *
   * La version de compatibilité ignore d'elle-même le canal là où il n'existe
   * pas, ce qui fait disparaître la branche de version.
   */
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
    return NotificationCompat.Builder(this, CHANNEL)
      .setContentTitle("Mino veille sur le temps d’écran")
      .setContentText("Les applications encadrées s’ouvrent avec le temps gagné.")
      .setSmallIcon(android.R.drawable.ic_lock_idle_lock)
      .setPriority(NotificationCompat.PRIORITY_LOW)
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

/**
 * Mino, dessiné au trait plutôt que chargé depuis un fichier.
 *
 * Le module natif n'a pas de dossier `res/`, et lui en donner un imposerait de
 * faire voyager une illustration entre le paquet JavaScript et le paquet
 * Android à chaque changement de charte. Une trentaine de courbes coûtent moins
 * cher que cette chaîne-là.
 *
 * Ce qu'il doit dire, et qui n'est pas négociable : **rien de triste, rien de
 * fâché.** Cet écran n'est pas une punition — l'enfant a dépensé son temps, ou
 * ne l'a pas encore lancé. Bras baissés, petit sourire, joues roses. Le cadran
 * sur le ventre est ce qui rend l'écran lisible sans savoir lire : il dit qu'il
 * est question de temps, et rien d'autre.
 */
private class MinoTempsEcouleView(context: Context) : View(context) {
  private val paint = Paint(Paint.ANTI_ALIAS_FLAG)

  private val bleu = Color.rgb(78, 182, 255)
  private val violet = Color.rgb(122, 124, 255)
  private val menthe = Color.rgb(43, 201, 138)
  private val rose = Color.rgb(255, 125, 160)
  private val bleuClair = Color.rgb(242, 246, 255)
  private val navy = Color.rgb(26, 29, 46)
  private val peche = Color.rgb(255, 181, 146)

  override fun onDraw(canvas: Canvas) {
    super.onDraw(canvas)
    val w = width.toFloat()
    val h = height.toFloat()
    if (w <= 0f || h <= 0f) return
    val cx = w / 2f

    // La bulle claire derrière : c'est elle qui détache le personnage du blanc.
    paint.style = Paint.Style.FILL
    paint.color = bleuClair
    canvas.drawCircle(cx, h * 0.47f, minOf(w, h) * 0.45f, paint)

    paint.color = Color.argb(20, 26, 29, 46)
    canvas.drawOval(RectF(w * 0.27f, h * 0.79f, w * 0.73f, h * 0.87f), paint)

    paint.color = bleu
    canvas.drawOval(RectF(w * 0.22f, h * 0.18f, w * 0.78f, h * 0.76f), paint)

    // Bras baissés, pas croisés ni levés : calme, et non contrarié.
    paint.strokeCap = Paint.Cap.ROUND
    paint.style = Paint.Style.STROKE
    paint.strokeWidth = w * 0.105f
    canvas.drawLine(w * 0.27f, h * 0.51f, w * 0.18f, h * 0.67f, paint)
    canvas.drawLine(w * 0.73f, h * 0.51f, w * 0.82f, h * 0.67f, paint)

    paint.style = Paint.Style.FILL
    canvas.drawRoundRect(
      RectF(w * 0.34f, h * 0.68f, w * 0.44f, h * 0.82f), w * 0.05f, w * 0.05f, paint
    )
    canvas.drawRoundRect(
      RectF(w * 0.56f, h * 0.68f, w * 0.66f, h * 0.82f), w * 0.05f, w * 0.05f, paint
    )

    paint.color = peche
    canvas.drawOval(RectF(w * 0.27f, h * 0.76f, w * 0.46f, h * 0.86f), paint)
    canvas.drawOval(RectF(w * 0.54f, h * 0.76f, w * 0.73f, h * 0.86f), paint)

    paint.color = Color.WHITE
    canvas.drawCircle(w * 0.40f, h * 0.39f, w * 0.095f, paint)
    canvas.drawCircle(w * 0.60f, h * 0.39f, w * 0.095f, paint)

    paint.color = navy
    canvas.drawCircle(w * 0.40f, h * 0.40f, w * 0.058f, paint)
    canvas.drawCircle(w * 0.60f, h * 0.40f, w * 0.058f, paint)

    paint.color = Color.WHITE
    canvas.drawCircle(w * 0.382f, h * 0.38f, w * 0.018f, paint)
    canvas.drawCircle(w * 0.582f, h * 0.38f, w * 0.018f, paint)

    paint.color = rose
    canvas.drawCircle(w * 0.32f, h * 0.49f, w * 0.045f, paint)
    canvas.drawCircle(w * 0.68f, h * 0.49f, w * 0.045f, paint)

    paint.style = Paint.Style.STROKE
    paint.strokeWidth = w * 0.018f
    paint.color = navy
    canvas.drawArc(RectF(w * 0.43f, h * 0.47f, w * 0.57f, h * 0.57f), 20f, 140f, false, paint)

    // Le cadran : ce qui fait comprendre « c'est une histoire de temps » à un
    // enfant qui ne lira pas une ligne de cet écran.
    paint.style = Paint.Style.FILL
    paint.color = Color.WHITE
    canvas.drawCircle(cx, h * 0.64f, w * 0.075f, paint)

    paint.style = Paint.Style.STROKE
    paint.strokeWidth = w * 0.014f
    paint.color = violet
    canvas.drawCircle(cx, h * 0.64f, w * 0.055f, paint)
    canvas.drawLine(cx, h * 0.64f, cx, h * 0.605f, paint)
    canvas.drawLine(cx, h * 0.64f, w * 0.525f, h * 0.655f, paint)

    paint.style = Paint.Style.FILL
    paint.color = menthe
    canvas.drawCircle(cx, h * 0.64f, w * 0.012f, paint)
  }
}
