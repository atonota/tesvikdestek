/** Anonymous surfaces: landing, explainer, catalogue, programme detail, onboarding. */

import { useState } from "react";
import { useNavigate, useParams } from "react-router";

import { useProgramsQuery, useSnapshotsQuery } from "@/api/queries";
import {
  Card,
  CatalogList,
  DefinitionList,
  DisclaimerBlock,
  EmptyState,
  Link,
  OpportunityDetail,
  PublicLanding,
  PublicShell,
} from "@/components";
import { CognitiveAuthOnboarding } from "@/components/cognitive-auth";
import { describeError } from "@/api/client";
import { readSourceRegistry } from "@/components";
import { QueryBoundary } from "./QueryBoundary";

/**
 * What an anonymous visitor is offered.
 *
 * `/yetenekler` used to be on this list and is not any more. It is a workspace
 * route: it renders inside the signed-in shell, with the private navigation and
 * a "Çıkış" button, and it reads the tenant's own capability picture. Offering
 * it from the public header sent visitors who had never signed in straight into
 * the private information architecture - and, before the session boundary
 * existed, straight into a generic 401 card wearing that shell.
 *
 * The capability picture is not being hidden. `/nasil-calisir` is the public
 * account of what this product does and does not do, and it is on this list.
 */
export const PUBLIC_NAV = [
  { to: "/programlar", label: "Programlar" },
  { to: "/nasil-calisir", label: "Nasıl çalışır" },
  { to: "/giris", label: "Giriş" },
] as const;

export function LandingRoute() {
  const programs = useProgramsQuery();
  const snapshots = useSnapshotsQuery();
  /*
   * Two reads, two fates, and they are not merged.
   *
   * The catalogue is gated by the boundary because the page is *about* it. The
   * registry is not: a landing page that disappears because one of its four
   * figures could not be read would be an over-correction, and the visitor
   * loses the programmes as well. So the registry read travels as data, and the
   * two counts it feeds say "okunamadı" instead of `0` when it failed.
   */
  const sources = readSourceRegistry(
    snapshots,
    snapshots.isError ? describeError(snapshots.error) : undefined,
  );

  return (
    <PublicShell navItems={PUBLIC_NAV}>
      <QueryBoundary query={programs} loadingLabel="Programlar yükleniyor">
        {(programList) => (
          <PublicLanding
            programCount={programList.length}
            snapshotCount={sources.rows?.length ?? null}
            verifiedSnapshotCount={
              sources.rows?.filter((snapshot) => snapshot.review_status === "verified").length ??
              null
            }
            sourcesRead={sources.state}
          />
        )}
      </QueryBoundary>
    </PublicShell>
  );
}

export function HowItWorksRoute() {
  return (
    <PublicShell navItems={PUBLIC_NAV}>
      <div className="dt-stack">
        <h1>Nasıl çalışır</h1>
        <ol className="dt-list dt-list--numbered">
          <li>
            <strong>Profil.</strong> Şirketinize dair on iki olguyu girersiniz. Emin olmadığınız
            her şey <em>Bilinmiyor</em> kalır — bu, hayır demek değildir.
          </li>
          <li>
            <strong>Kural.</strong> Her program için sürümlenmiş, resmî kaynağa bağlı bir kural
            kümesi çalışır. Kurallar veridir, kod değildir; tarayıcıda çalıştırılmaz.
          </li>
          <li>
            <strong>Sonuç.</strong> Dört değerden biri üretilir ve hangi koşulun nerede takıldığı
            satır satır gösterilir.
          </li>
          <li>
            <strong>Kanıt.</strong> Her karar, dayandığı kaynak yakalamasının kimliğini ve iki
            özet değerini taşır; aynı girdi aynı özeti üretir.
          </li>
        </ol>
        <Card title="Dört sonuç" headingLevel={2}>
          <DefinitionList
            items={[
              { term: "Aday uygunluk", description: "Koşullar elimizdeki veriyle sağlanıyor görünüyor." },
              { term: "Koşullu", description: "Bir şey bilinmiyor; örneğin çağrı penceresi yayımlanmamış." },
              { term: "Yetersiz veri", description: "Profilde eksik olgu var; hangileri olduğu adıyla listelenir." },
              { term: "Uygun değil", description: "En az bir koşul açıkça sağlanmıyor." },
            ]}
          />
          <p className="dt-muted">“Resmen onaylandı” diye bir sonuç yoktur.</p>
        </Card>
        <DisclaimerBlock />
      </div>
    </PublicShell>
  );
}

export function PublicCatalogRoute() {
  const programs = useProgramsQuery();
  return (
    <PublicShell navItems={PUBLIC_NAV}>
      <QueryBoundary query={programs}>
        {(list) => <CatalogList programs={list} />}
      </QueryBoundary>
    </PublicShell>
  );
}

export function PublicProgramDetailRoute() {
  const { code = "" } = useParams();
  const programs = useProgramsQuery();
  const snapshots = useSnapshotsQuery();
  const sources = readSourceRegistry(
    snapshots,
    snapshots.isError ? describeError(snapshots.error) : undefined,
  );

  return (
    <PublicShell navItems={PUBLIC_NAV}>
      <QueryBoundary query={programs}>
        {(list) => {
          const program = list.find((candidate) => candidate.code === code);
          if (!program) {
            return (
              <EmptyState
                title="Program bulunamadı"
                reason={`"${code}" kodlu bir program katalogda yok.`}
                action={<Link to="/programlar">Katalog</Link>}
              />
            );
          }
          return (
            <OpportunityDetail
              program={program}
              snapshots={sources.rows}
              sourcesRead={sources.state}
            />
          );
        }}
      </QueryBoundary>
    </PublicShell>
  );
}

const ONBOARDING_STEP_COUNT = 3;

export function OnboardingRoute() {
  const [step, setStep] = useState(0);
  const navigate = useNavigate();

  return (
    <CognitiveAuthOnboarding
      step={step}
      onBack={() => setStep(step - 1)}
      onNext={() => setStep(Math.min(step + 1, ONBOARDING_STEP_COUNT - 1))}
      onFinish={() => void navigate("/kayit")}
    />
  );
}
