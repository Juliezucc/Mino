/**
 * La cible d'extension qui repose le bouclier, décrite plutôt que cliquée.
 *
 * Jusqu'ici, cette cible devait être créée **à la main dans Xcode**, sur un Mac,
 * et `docs/ops/premiere-compilation.md` avertissait qu'un `expo prebuild` la
 * détruirait sans rien dire — l'application continuant de compiler sans elle, et
 * le bouclier ne revenant plus jamais seul. C'était le piège le plus coûteux du
 * projet : silencieux, et sur la seule promesse que Mino doit tenir.
 *
 * Décrite ici, elle est reconstruite à chaque prebuild. Le piège n'existe plus,
 * et surtout : **il n'y a plus besoin de Mac.** EAS compile sur du matériel
 * Apple, dans le nuage, extension comprise.
 *
 * @type {import('@bacons/apple-targets/app.plugin').ConfigFunction}
 */
module.exports = (config) => ({
  type: 'device-activity-monitor',
  name: 'MinoShieldMonitor',
  displayName: 'Mino',

  // Le point commence par un point : il se colle à l'identifiant de
  // l'application. On retrouve `fr.minoapp.mino.MinoShieldMonitor`, qui est
  // exactement l'identifiant déclaré chez Apple.
  bundleIdentifier: '.MinoShieldMonitor',

  // La même que l'application. `ManagedSettings` et `DeviceActivity` ne
  // tiennent ensemble qu'à partir d'iOS 16, et le SDK 57 exige au moins 16.4.
  deploymentTarget: '16.4',

  entitlements: {
    // Sans elle, l'extension ne peut pas toucher au magasin de réglages : elle
    // se réveillerait à l'heure dite et ne pourrait rien reposer.
    'com.apple.developer.family-controls': true,
    // **Leur seule mémoire commune.** La sélection d'applications et l'échéance
    // y transitent. Reprise telle quelle de l'application pour qu'un
    // changement de groupe ne puisse pas les désaccorder.
    'com.apple.security.application-groups':
      config.ios.entitlements['com.apple.security.application-groups'],
  },
});
