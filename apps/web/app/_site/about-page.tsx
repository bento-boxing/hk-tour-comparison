import type { Metadata } from 'next';
import { makeT, type DictKey, type Locale, type T } from '../../lib/i18n';
import { siteIdentity } from '../../lib/site-identity';
import { pageMetadata } from '../../lib/site-metadata';
import frame from './site-frame.module.css';
import styles from './about-page.module.css';

/** Its own title and description; no database. */
export function aboutPageMetadata(locale: Locale): Metadata {
  const t = makeT(locale);
  return pageMetadata(t, '/about', { title: t('about.title'), description: t('about.description') });
}

/** A sentence with its {email} placeholder made a mailto link to the contact address (CONTACT_EMAIL). */
function withEmail(t: T, key: DictKey) {
  const { contactEmail } = siteIdentity();
  const [before, after = ''] = t(key).split('{email}');
  return <>{before}<a className={styles.link} href={`mailto:${contactEmail}`}>{contactEmail}</a>{after}</>;
}

/**
 * The about page in `locale` (/about: app/(zh-hant)/about/page.tsx and the same in app/zh-hans and app/en): what the
 * site is, what it shows and never copies, how its data is collected, how fresh it is, and how to have something
 * corrected or removed. Plain text from the dictionaries (about.*), which follow 給旅行社的說明 in README.md.
 */
export function AboutPage({ locale }: { locale: Locale }) {
  const t = makeT(locale);
  const list = (keys: DictKey[]) => <ul className={styles.list}>{keys.map(key => <li key={key}>{t(key)}</li>)}</ul>;
  return (
    <div className={`${frame.wrap} ${frame.page}`}>
      <article className={styles.about}>
        <h1 className={styles.heading}>{t('about.title')}</h1>
        <p>{t('about.intro')}</p>

        <h2 className={styles.subheading}>{t('about.showHeading')}</h2>
        {list(['about.show1', 'about.show2', 'about.show3'])}

        <h2 className={styles.subheading}>{t('about.collectHeading')}</h2>
        {list(['about.collect1', 'about.collect2', 'about.collect3', 'about.collect4'])}

        <h2 className={styles.subheading}>{t('about.pricesHeading')}</h2>
        <p>{t('about.prices')}</p>

        <h2 className={styles.subheading}>{t('about.fixHeading')}</h2>
        <p>{withEmail(t, 'about.fix')}</p>
        <p>{t('about.remove')}</p>
      </article>
    </div>
  );
}
