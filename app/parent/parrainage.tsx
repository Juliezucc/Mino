import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Share, StyleSheet, View } from 'react-native';

import { Button, Card, Field, Screen, ScreenHeader, Text } from '@/components/ui';
import { REFERRAL, TRIAL_DAYS, creditedMonthsInYear } from '@/domain/billing';
import { useFamily } from '@/store/selectors';
import { useMinoStore } from '@/store/useMinoStore';
import { colors, radii, spacing } from '@/theme';

const STATUS_LABEL: Record<string, { label: string; tone: string }> = {
  pending: { label: 'En essai', tone: colors.textMuted },
  qualified: { label: 'Mois à venir', tone: colors.yellow },
  credited: { label: 'Mois offert ✓', tone: colors.mint },
  rejected: { label: 'Non retenu', tone: colors.textSubtle },
};

/**
 * Le parrainage.
 *
 * **À sens unique, et c'est délibéré.** Le filleul reçoit ses trente jours
 * d'essai comme tout le monde ; le parrain reçoit un mois, une fois que ce
 * filleul a réellement payé. Récompenser à l'inscription reviendrait à payer
 * pour des comptes plutôt que pour des clients — c'est par là que ce genre de
 * programme se fait vider.
 *
 * Cet écran a longtemps promis soixante jours au filleul. Ce n'est plus le cas
 * depuis que l'essai est porté par la boutique : une offre d'introduction a une
 * durée fixe, la même pour tous.
 */
export default function ReferralScreen() {
  const router = useRouter();
  const data = useFamily();
  const referrals = useMinoStore((s) => s.referrals);
  const subscription = useMinoStore((s) => s.subscription);
  const redeemReferral = useMinoStore((s) => s.redeemReferral);
  const recupererMoisOffert = useMinoStore((s) => s.recupererMoisOffert);

  const [code, setCode] = useState('');
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [loading, setLoading] = useState(false);

  if (!data) return null;

  const myCode = data.family.referralCode;
  const earned = creditedMonthsInYear(referrals, data.family.id);
  const canRedeem = subscription?.status === 'trialing';

  /**
   * Le mois dû, et le geste qu'Apple impose pour l'obtenir.
   *
   * `creditMonths` compte ce que Mino doit encore au parrain. Sur le web il ne
   * dépasse jamais zéro longtemps : le mois est appliqué par le serveur au
   * moment où le filleul paie. Sur l'App Store, il attend — l'offre
   * promotionnelle doit être acceptée par l'abonné, elle ne s'applique pas
   * toute seule. Sans ce bouton, le mois resterait compté et jamais donné.
   */
  const moisDus = subscription?.creditMonths ?? 0;

  const recuperer = async () => {
    setLoading(true);
    setMessage(null);
    const issue = await recupererMoisOffert();
    if (issue.kind === 'done') {
      setMessage({ ok: true, text: 'C’est fait : votre mois offert s’applique à votre prochaine échéance.' });
    } else if (issue.kind === 'failed') {
      setMessage({ ok: false, text: issue.reason });
    }
    // `abandoned` : la feuille a été refermée. Ce n'est pas un échec, et le
    // mois reste dû — rien à dire.
    setLoading(false);
  };

  const share = () => {
    Share.share({
      message: `On utilise Mino à la maison : les enfants gagnent leur temps d’écran en faisant leurs missions. Tu as ${TRIAL_DAYS} jours d’essai, et avec mon code ${myCode} tu me fais gagner un mois.`,
    }).catch(() => undefined);
  };

  const redeem = async () => {
    setLoading(true);
    const result = await redeemReferral(code);
    setMessage(
      result.ok
        ? {
            ok: true,
            // On ne remercie pas quelqu'un en lui faisant croire qu'il a gagné
            // quelque chose : ce qu'il vient de faire, c'est offrir un mois.
            text: 'C’est enregistré. La famille qui vous a invité recevra son mois offert dès votre premier paiement.',
          }
        : { ok: false, text: result.reason ?? 'Ce code n’a pas pu être utilisé.' },
    );
    if (result.ok) setCode('');
    setLoading(false);
  };

  return (
    <Screen contentStyle={styles.content}>
      <ScreenHeader onBack={() => router.back()} title="Parrainage" />

      <Card style={styles.codeCard} background={colors.blueSoft} elevation="none">
        <Text variant="label" color={colors.blueInk}>
          MON CODE
        </Text>
        <Text variant="display" color={colors.blueInk} style={styles.code}>
          {myCode}
        </Text>
        <Button label="Partager mon code" icon="🎁" onPress={share} />
      </Card>

      {moisDus > 0 ? (
        <Card style={styles.block} background={colors.mintSoft} elevation="none">
          <Text variant="cardTitle">
            {moisDus > 1 ? `${moisDus} mois vous attendent` : 'Un mois vous attend'}
          </Text>
          <Text variant="body" color={colors.textMuted}>
            Votre filleul s’est abonné. Confirmez pour l’appliquer à votre prochaine échéance —
            l’App Store demande votre accord, il ne peut pas le faire à votre place.
          </Text>
          <Button label="Récupérer mon mois offert" icon="🎁" loading={loading} onPress={recuperer} />
        </Card>
      ) : null}

      <Card style={styles.block}>
        <Text variant="cardTitle">Comment ça marche</Text>
        <View style={styles.steps}>
          {[
            `La famille que vous invitez démarre avec ses ${TRIAL_DAYS} jours d’essai, comme tout le monde.`,
            `Dès qu’elle devient abonnée, vous recevez ${REFERRAL.referrerFreeMonths} mois offert.`,
            'Chaque mois offert est déduit de votre prochaine facture. Ils se cumulent.',
            `Maximum ${REFERRAL.maxFreeMonthsPerYear} mois offerts par an.`,
          ].map((step, index) => (
            <View key={step} style={styles.step}>
              <View style={styles.number}>
                <Text variant="caption" color={colors.onBrand}>
                  {index + 1}
                </Text>
              </View>
              <Text variant="body" color={colors.textMuted} style={styles.stepText}>
                {step}
              </Text>
            </View>
          ))}
        </View>
      </Card>

      <Card style={styles.block}>
        <Text variant="cardTitle">
          {referrals.length > 0
            ? `Mes filleuls · ${earned} mois offert${earned > 1 ? 's' : ''}`
            : 'Mes filleuls'}
        </Text>
        {referrals.length === 0 ? (
          <Text variant="body" color={colors.textMuted}>
            Personne pour l’instant. Partagez votre code à une famille à qui Mino ferait du bien.
          </Text>
        ) : (
          <View style={styles.list}>
            {referrals.map((referral) => {
              const status = STATUS_LABEL[referral.status] ?? STATUS_LABEL.pending;
              return (
                <View key={referral.id} style={styles.row}>
                  <Text variant="body">
                    {new Date(referral.createdAt).toLocaleDateString('fr-FR', {
                      day: 'numeric',
                      month: 'long',
                    })}
                  </Text>
                  <Text variant="label" color={status.tone}>
                    {status.label}
                  </Text>
                </View>
              );
            })}
          </View>
        )}
      </Card>

      {canRedeem ? (
        <Card style={styles.block}>
          <Text variant="cardTitle">Un ami vous a invité ?</Text>
          {/* Ce que ce champ fait, dit sans détour : il ne vous donne rien, il
              donne un mois à celui qui vous a invité. Laisser croire l'inverse
              se paierait au premier relevé bancaire. */}
          <Text variant="body" color={colors.textMuted}>
            Entrez son code : il gagnera un mois d’abonnement dès votre premier paiement. Votre
            essai, lui, ne change pas. À saisir pendant l’essai.
          </Text>
          <Field
            placeholder="Code à 6 caractères"
            autoCapitalize="characters"
            value={code}
            onChangeText={(v) => setCode(v.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6))}
          />
          {message ? (
            <Text variant="caption" color={message.ok ? colors.mintInk : colors.dangerInk}>
              {message.text}
            </Text>
          ) : null}
          <Button
            label="UTILISER CE CODE"
            onPress={redeem}
            disabled={code.length !== 6}
            loading={loading}
          />
        </Card>
      ) : null}

      <Text variant="caption" color={colors.textSubtle} center>
        Les mois offerts n’ont pas de valeur monétaire et ne sont pas remboursables.
      </Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingTop: spacing.md, paddingBottom: spacing.xl, gap: spacing.lg },
  codeCard: { alignItems: 'center', gap: spacing.md, paddingVertical: spacing.xl },
  code: { letterSpacing: 6 },
  block: { gap: spacing.md },
  steps: { gap: spacing.md },
  step: { flexDirection: 'row', gap: spacing.md, alignItems: 'flex-start' },
  number: {
    width: 22,
    height: 22,
    borderRadius: radii.pill,
    backgroundColor: colors.blue,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  stepText: { flex: 1 },
  list: { gap: spacing.sm },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
});
