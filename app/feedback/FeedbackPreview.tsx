"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { SiteLocale } from "../i18n";
import FeedbackCard, { type PublicFeedbackRecord } from "./FeedbackCard";

const copy = {
  en: { tag: "Buyer feedback", title: "Recent service reviews", all: "View all feedback", empty: "Feedback is being prepared." },
  pt: { tag: "Feedback de compradores", title: "Avaliações recentes do serviço", all: "Ver todo o feedback", empty: "O feedback está sendo preparado." },
  es: { tag: "Opiniones de compradores", title: "Reseñas recientes del servicio", all: "Ver todos los comentarios", empty: "Los comentarios se están preparando." },
  fr: { tag: "Avis des acheteurs", title: "Avis récents sur le service", all: "Voir tous les avis", empty: "Les avis sont en cours de préparation." },
  zh: { tag: "采购反馈", title: "近期服务评价", all: "查看全部反馈", empty: "反馈内容正在整理中。" },
} as const;

export default function FeedbackPreview({ locale }: { locale: SiteLocale }) {
  const [records, setRecords] = useState<PublicFeedbackRecord[]>([]);
  const [loaded, setLoaded] = useState(false);
  const t = copy[locale];
  useEffect(() => {
    let active = true;
    fetch(`/api/feedback?locale=${locale}&limit=4`, { cache: "no-store" })
      .then((response) => (response.ok ? response.json() : Promise.reject()))
      .then((data: { records?: PublicFeedbackRecord[] }) => {
        if (active) setRecords(data.records ?? []);
      })
      .catch(() => undefined)
      .finally(() => {
        if (active) setLoaded(true);
      });
    return () => {
      active = false;
    };
  }, [locale]);

  return (
    <section className="feedback-preview section-shell" aria-labelledby="feedback-preview-title">
      <div className="feedback-preview-heading">
        <div>
          <p className="section-tag">{t.tag}</p>
          <h2 id="feedback-preview-title">{t.title}</h2>
        </div>
        <Link href="/feedback">{t.all}<span aria-hidden="true">↗</span></Link>
      </div>
      {records.length > 0 ? (
        <div className="feedback-preview-grid">
          {records.map((record) => <FeedbackCard record={record} locale={locale} key={record.id} />)}
        </div>
      ) : loaded ? (
        <p className="feedback-empty">{t.empty}</p>
      ) : (
        <div className="feedback-loading" aria-label="Loading feedback" />
      )}
    </section>
  );
}
