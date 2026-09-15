import {
  DEFAULT_PREFERENCES,
  bonusGranted,
  completionApproved,
  completionRejected,
  isQuietHour,
  missionCompleted,
  sessionEndingSoon,
  recoitLesNotificationsParent,
  sessionRequested,
  shouldDeliver,
  usageDeLAppareil,
  recoitLesNotificationsEnfant,
  livrableMaintenant,
  QUIET_FROM_HOUR,
  QUIET_UNTIL_HOUR,
} from '@/domain/notifications';
import { Child, Device, Mission } from '@/domain/types';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const child = (over: Partial<Child> = {}): Child => ({
  id: 'c1',
  familyId: 'f1',
  firstName: 'Noah',
  age: 8,
  avatarKey: 'fox',
  createdAt: '2026-01-01T00:00:00.000Z',
  ...over,
});

const mission: Mission = {
  id: 'm1',
  familyId: 'f1',
  title: 'Ranger ma chambre',
  icon: '🧸',
  minutes: 15,
  repeat: { kind: 'daily' },
  createdBy: 'p1',
  archived: false,
  createdAt: '2026-01-01T00:00:00.000Z',
};

const devices: Device[] = [
  { id: 'd1', familyId: 'f1', label: 'Nintendo Switch', kind: 'console', createdAt: '2026-01-01' },
];

const at = (hour: number) => new Date(`2026-08-20T${String(hour).padStart(2, '0')}:30:00`);

describe('who hears what', () => {
  it('tells the parents when a mission is waiting on them', () => {
    const payload = missionCompleted(child(), mission);
    expect(payload.audience).toBe('parents');
    expect(payload.body).toContain('Ranger ma chambre');
  });

  it('tells the child when the minutes have landed, in their own words', () => {
    expect(completionApproved(child({ age: 8 }), 15).body).toBe('Tu as gagné 15 minos.');
    expect(completionApproved(child({ age: 15 }), 15).body).toBe('Tu as gagné 15 min.');
  });

  it('says a refused mission came back, and blames nobody', () => {
    const payload = completionRejected(child(), mission);
    expect(payload.title).toBe('Mission à refaire');
    expect(payload.body).not.toMatch(/pas fait|raté|non/i);
  });

  it('names the screen a request is for', () => {
    expect(sessionRequested(child(), 20, devices, 'd1').body).toBe('20 min sur Nintendo Switch');
  });

  it('carries the reason on a bonus, since that is what gives it value', () => {
    expect(bonusGranted(child(), 15, 'Belle journée').body).toBe('Belle journée');
  });
});

describe('quiet hours', () => {
  it('covers the evening and the night', () => {
    expect(isQuietHour(at(19))).toBe(false);
    expect(isQuietHour(at(20))).toBe(true);
    expect(isQuietHour(at(23))).toBe(true);
    expect(isQuietHour(at(6))).toBe(true);
    expect(isQuietHour(at(7))).toBe(false);
  });

  it('holds a validation until the morning', () => {
    const payload = completionApproved(child(), 15);
    expect(shouldDeliver(payload, DEFAULT_PREFERENCES, at(21))).toBe(false);
    expect(shouldDeliver(payload, DEFAULT_PREFERENCES, at(18))).toBe(true);
  });

  it('lets the five-minute warning through anyway', () => {
    // A screen going dark with no warning is worse than one buzz at 20h30.
    const payload = sessionEndingSoon(child(), new Date(Date.now() + 20 * 60_000).toISOString())!;
    expect(shouldDeliver(payload, DEFAULT_PREFERENCES, at(21))).toBe(true);
  });

  it('can be turned off deliberately', () => {
    const payload = completionApproved(child(), 15);
    expect(shouldDeliver(payload, { ...DEFAULT_PREFERENCES, quietHours: false }, at(21))).toBe(true);
  });
});

describe('preferences', () => {
  it('mutes one side without muting the other', () => {
    const forParents = missionCompleted(child(), mission);
    const forChild = completionApproved(child(), 15);
    const parentsOff = { ...DEFAULT_PREFERENCES, parents: false };

    expect(shouldDeliver(forParents, parentsOff, at(12))).toBe(false);
    expect(shouldDeliver(forChild, parentsOff, at(12))).toBe(true);
  });
});

describe('the five-minute warning', () => {
  it('is scheduled five minutes before the end', () => {
    const now = new Date('2026-08-20T14:00:00.000Z');
    const endsAt = new Date('2026-08-20T14:20:00.000Z').toISOString();

    expect(sessionEndingSoon(child(), endsAt, now)!.inSeconds).toBe(15 * 60);
  });

  it('is skipped entirely on a session too short to warn about', () => {
    const now = new Date('2026-08-20T14:00:00.000Z');
    // Five minutes of screen time would mean buzzing as it starts.
    expect(sessionEndingSoon(child(), new Date('2026-08-20T14:05:00.000Z').toISOString(), now)).toBeNull();
    expect(sessionEndingSoon(child(), new Date('2026-08-20T14:02:00.000Z').toISOString(), now)).toBeNull();
  });
});

/**
 * ---------------------------------------------------------------------------
 * « Raphaël a terminé sa mission », sur l'écran de Raphaël
 * ---------------------------------------------------------------------------
 *
 * Relevé sur une vraie tablette. Le parent valide une mission depuis l'espace
 * parent, et l'annonce destinée au parent s'affiche sur la tablette que
 * l'enfant tient. Le serveur avait raison sur le compte — la famille est née
 * sur cet appareil, c'est donc un compte parent — et tort sur la situation.
 *
 * L'inscription pose pourtant la question, « à qui est cet appareil ? », mais
 * la réponse restait dans le téléphone et n'en sortait jamais.
 */
describe('à qui est cet appareil', () => {
  it('déduit le genre des trois réponses de l’inscription', () => {
    expect(usageDeLAppareil({ lockedChildId: 'noah', usagePersonnel: false })).toBe('enfant');
    expect(usageDeLAppareil({ lockedChildId: null, usagePersonnel: true })).toBe('parent');
    expect(usageDeLAppareil({ lockedChildId: null, usagePersonnel: false })).toBe('partage');
  });

  it('fait primer la réservation sur tout le reste', () => {
    // Un parent qui a d'abord dit « c'est mon téléphone » puis l'a réservé à
    // son fils a changé d'avis : c'est le dernier geste qui vaut.
    expect(usageDeLAppareil({ lockedChildId: 'noah', usagePersonnel: true })).toBe('enfant');
  });
});

describe('qui reçoit les notifications de parent', () => {
  it('n’écrit jamais à l’appareil réservé à un enfant', () => {
    // « Confirmez la mission de Raphaël » sur le téléphone de Raphaël : au
    // mieux inutile, au pire cela lui apprend qu'un écran de validation existe.
    expect(recoitLesNotificationsParent('enfant', ['enfant', 'parent'])).toBe(false);
    expect(recoitLesNotificationsParent('enfant', ['enfant'])).toBe(false);
  });

  it('écrit toujours au téléphone du parent', () => {
    expect(recoitLesNotificationsParent('parent', ['parent', 'partage', 'enfant'])).toBe(true);
  });

  it('épargne la tablette partagée quand un téléphone de parent existe', () => {
    // Le parent est déjà prévenu sur son téléphone. Doubler sur la tablette du
    // salon ne prévient personne de plus, et met l'annonce sous les yeux de
    // l'enfant.
    expect(recoitLesNotificationsParent('partage', ['parent', 'partage'])).toBe(false);
  });

  it('écrit à la tablette partagée quand c’est le seul chemin', () => {
    // Le cas le plus fréquent des familles qui n'ont qu'une tablette. La
    // couper laisserait le parent sans nouvelles — bien pire que l'inverse.
    expect(recoitLesNotificationsParent('partage', ['partage'])).toBe(true);
    expect(recoitLesNotificationsParent('partage', ['partage', 'enfant'])).toBe(true);
  });

  it('ne retire rien à un appareil dont on ignore le genre', () => {
    // C'est ce que portent les installations pas encore mises à jour. Couper
    // leurs notifications sur la foi d'une information qu'on n'a pas serait
    // exactement la faute que cette règle existe pour corriger.
    expect(recoitLesNotificationsParent('inconnu', ['parent'])).toBe(true);
    expect(recoitLesNotificationsParent('inconnu', ['inconnu'])).toBe(true);
  });
});

/**
 * La même règle vit à deux endroits, et il n'y a pas moyen de faire autrement :
 * une fonction Edge tourne sous Deno et ne peut pas importer un module React
 * Native. Ce test lit donc le fichier serveur et vérifie qu'il dit bien la
 * même chose que la version éprouvée ci-dessus — faute de quoi les deux
 * dérivent en silence, et le défaut revient.
 */
describe('le serveur applique la même règle', () => {
  const edge = readFileSync('supabase/functions/notify/index.ts', 'utf8');

  it('lit le genre de l’appareil', () => {
    expect(edge).toContain("select('user_id, token, usage, fuseau, heures_calmes')");
  });

  it('exclut l’appareil réservé à un enfant', () => {
    expect(edge).toContain("if (genre === 'enfant') return false;");
  });

  it('n’écrit à la tablette partagée qu’à défaut de téléphone de parent', () => {
    expect(edge).toContain("if (genre === 'partage') return !unTelephoneDeParent;");
  });

  it('n’envoie JAMAIS les annonces de l’enfant au téléphone d’un parent', () => {
    // Le jumeau de `recoitLesNotificationsEnfant`. Sans cette ligne dans la
    // fonction, le père reçoit « Bravo Raphaël, +15 minos ! » — et l'essai du
    // domaine, lui, reste vert : c'est exactement l'écart que ce bloc existe
    // pour refuser. Vérifié en retirant la ligne.
    expect(edge).toContain("((j.usage as string | null) ?? 'inconnu') === 'parent') return false;");
  });

  it('laisse recevoir ce dont il ignore le genre', () => {
    expect(edge).toContain("?? 'inconnu'");
  });
});

/**
 * « Bravo Raphaël, +15 minos ! » ne va pas au téléphone de son père.
 *
 * **Le défaut, apparu en donnant un vrai profil au second parent.** Son
 * téléphone s'inscrit dans `family_devices` comme tout appareil appairé, avec
 * `child_id` nul — exactement la signature d'une tablette partagée. La règle
 * « un appareil partagé reçoit aussi » l'attrapait donc, et le père recevait
 * les annonces écrites pour son fils : tutoyées, comptées en minos, félicitant
 * quelqu'un d'autre.
 */
describe('les annonces de l’enfant', () => {
  it('n’arrivent jamais sur le téléphone d’un parent', () => {
    expect(recoitLesNotificationsEnfant('parent')).toBe(false);
  });

  it('arrivent sur la tablette partagée — sinon le salon ne dirait jamais rien', () => {
    // Et c'est pour cela que la règle ne peut pas regarder le COMPTE : sur la
    // tablette du salon, c'est souvent celui d'un parent qui est ouvert.
    expect(recoitLesNotificationsEnfant('partage')).toBe(true);
  });

  it('arrivent sur l’appareil de l’enfant', () => {
    expect(recoitLesNotificationsEnfant('enfant')).toBe(true);
  });

  it('arrivent sur une installation qui n’a pas encore répondu', () => {
    // `inconnu` n'est exclu de rien : retirer des notifications sur la foi
    // d'une information qu'on n'a pas serait la faute qu'on corrige.
    expect(recoitLesNotificationsEnfant('inconnu')).toBe(true);
  });
});

/**
 * Les heures calmes, appliquées LÀ OÙ la notification est livrée.
 *
 * **Le défaut : la règle ne vivait que sur l'appareil qui envoie.** Elle était
 * appliquée par le téléphone qui venait d'agir, avec ses préférences et son
 * horloge — juste tant que la notification était locale. Or depuis que le
 * serveur pousse aux autres appareils, c'est lui qui livre, et `notify` ne
 * consultait AUCUNE heure : pas une mention dans tout le fichier. Le téléphone
 * d'un enfant pouvait sonner à 22 h 40.
 *
 * Trois données décident, et toutes trois appartiennent au destinataire — son
 * fuseau, sa préférence, le genre de ce qui arrive. Deux téléphones d'une même
 * maison peuvent être dans deux pays.
 */
describe('se taire la nuit, chez celui qui reçoit', () => {
  const a = (heureUtc: number) => new Date(Date.UTC(2026, 8, 15, heureUtc, 30));

  it('se tait à 22 h à Paris', () => {
    // 20 h UTC = 22 h à Paris en septembre.
    expect(
      livrableMaintenant({
        kind: 'mission.completed',
        heuresCalmes: true,
        fuseau: 'Europe/Paris',
        maintenant: a(20),
      }),
    ).toBe(false);
  });

  it('parle à 22 h UTC quand le destinataire est à la Martinique', () => {
    // 22 h UTC = 18 h à Fort-de-France : chez lui, il fait encore jour.
    // Lire l'heure du serveur l'aurait fait taire pour rien.
    expect(
      livrableMaintenant({
        kind: 'mission.completed',
        heuresCalmes: true,
        fuseau: 'America/Martinique',
        maintenant: a(22),
      }),
    ).toBe(true);
  });

  it('suppose Paris quand l’appareil n’a pas dit son fuseau', () => {
    // Les versions déjà installées n'envoient rien. Se taire entièrement
    // priverait une famille de ses notifications sans qu'elle le sache ;
    // livrer aveuglément ramènerait le défaut.
    expect(
      livrableMaintenant({
        kind: 'mission.completed',
        heuresCalmes: true,
        fuseau: null,
        maintenant: a(20),
      }),
    ).toBe(false);
  });

  it('laisse passer l’avertissement de fin de séance', () => {
    // Se taire cinq minutes avant la fin, c'est un écran qui s'éteint sans
    // prévenir. Un buzz vaut mieux qu'une coupure sèche.
    expect(
      livrableMaintenant({
        kind: 'session.endingSoon',
        heuresCalmes: true,
        fuseau: 'Europe/Paris',
        maintenant: a(20),
      }),
    ).toBe(true);
  });

  it('respecte la famille qui a coupé la règle', () => {
    expect(
      livrableMaintenant({
        kind: 'mission.completed',
        heuresCalmes: false,
        fuseau: 'Europe/Paris',
        maintenant: a(20),
      }),
    ).toBe(true);
  });

  it('parle à 10 h', () => {
    expect(
      livrableMaintenant({
        kind: 'mission.completed',
        heuresCalmes: true,
        fuseau: 'Europe/Paris',
        maintenant: a(8),
      }),
    ).toBe(true);
  });

  it('ne lève pas sur un fuseau inconnu', () => {
    // Une notification perdue pour cause d'exception serait le pire des deux
    // mondes.
    expect(() =>
      livrableMaintenant({
        kind: 'mission.completed',
        heuresCalmes: true,
        fuseau: 'Mars/Olympus_Mons',
        maintenant: a(8),
      }),
    ).not.toThrow();
  });
});

describe('la fonction Edge applique la même règle', () => {
  const source = readFileSync(
    join(__dirname, '..', 'supabase/functions/notify/index.ts'),
    'utf8',
  );

  it('lit le fuseau et la préférence du destinataire', () => {
    expect(source).toMatch(/select\('user_id, token, usage, fuseau, heures_calmes'\)/);
  });

  it('porte les mêmes bornes que le domaine', () => {
    // Une fonction Edge ne peut pas importer un module React Native : les deux
    // versions coexistent, et cet essai refuse qu'elles divergent.
    expect(source).toMatch(new RegExp(`CALME_DE = ${QUIET_FROM_HOUR}`));
    expect(source).toMatch(new RegExp(`CALME_JUSQUA = ${QUIET_UNTIL_HOUR}`));
  });

  it('laisse passer le même genre', () => {
    expect(source).toMatch(/corps\.kind === 'session\.endingSoon'/);
  });

  it('et le client envoie ce genre', () => {
    const client = readFileSync(
      join(__dirname, '..', 'src/services/notifications/jetonPush.ts'),
      'utf8',
    );
    expect(client).toMatch(/kind: payload\.kind/);
    expect(client).toMatch(/fuseau,/);
    expect(client).toMatch(/heures_calmes: heuresCalmes/);
  });
});
