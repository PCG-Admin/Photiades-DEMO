'use client';

/* i18n — English / Greek translation layer.
   Usage: const tr = useTr(); tr('Dashboard') returns the string in the current language.
   Keyed by the English source string so untranslated keys fall back gracefully. */

import { useCallback } from 'react';
import { useTheme } from '@/components/providers/ThemeProvider';

export type Lang = 'en' | 'el';

export const TRANSLATIONS: Record<Exclude<Lang, 'en'>, Record<string, string>> = {
  el: {
    // Brand / chrome
    'Workflow Portal': 'Πύλη Ροής Εργασιών',
    'Portal': 'Πύλη',
    'Storage': 'Αποθηκευτικός χώρος',
    '64% of 2 TB · 1.28 TB used': '64% από 2 TB · 1,28 TB σε χρήση',
    'Search invoices, documents, vendors…': 'Αναζήτηση τιμολογίων, εγγράφων, προμηθευτών…',
    'Toggle theme': 'Εναλλαγή θέματος',
    'Notifications': 'Ειδοποιήσεις',
    'Language': 'Γλώσσα',

    // Nav sections
    'Workspace': 'Χώρος εργασίας',
    'Insight': 'Αναλύσεις',
    'Administration': 'Διαχείριση',
    // Nav items / titles
    'Dashboard': 'Πίνακας ελέγχου',
    'Document Capture': 'Καταχώρηση εγγράφων',
    'Invoice Processing': 'Επεξεργασία τιμολογίων',
    'Workflows': 'Ροές εργασιών',
    'Reports': 'Αναφορές',
    'Reports & Analytics': 'Αναφορές & Αναλύσεις',
    'Audit Trail': 'Ιστορικό ελέγχου',
    'User Administration': 'Διαχείριση χρηστών',

    // Profile menu
    'My profile': 'Το προφίλ μου',
    'Preferences': 'Προτιμήσεις',
    'Security & MFA': 'Ασφάλεια & MFA',
    'Light mode': 'Φωτεινό θέμα',
    'Dark mode': 'Σκούρο θέμα',
    'Sign out': 'Αποσύνδεση',

    // Tweaks panel
    'Brand accent': 'Χρώμα μάρκας',
    'Accent color': 'Χρώμα τόνου',
    'Layout': 'Διάταξη',
    'Density': 'Πυκνότητα',
    'Appearance': 'Εμφάνιση',
    'Corporate Blue': 'Εταιρικό μπλε',
    'Deep Teal': 'Βαθύ τιρκουάζ',
    'Forest': 'Δάσος',
    'Plum': 'Δαμάσκηνο',
    'compact': 'συμπαγής',
    'comfortable': 'άνετη',
    'spacious': 'ευρύχωρη',

    // Common actions / labels
    'View reports': 'Προβολή αναφορών',
    'Capture document': 'Καταχώρηση εγγράφου',
    'Upload document': 'Μεταφόρτωση εγγράφου',
    'Scan': 'Σάρωση',
    'Add file': 'Προσθήκη αρχείου',
    'Export': 'Εξαγωγή',
    'New invoice': 'Νέο τιμολόγιο',
    'Filters': 'Φίλτρα',
    'Approve': 'Έγκριση',
    'Reject': 'Απόρριψη',
    'Save': 'Αποθήκευση',
    'Save & store': 'Αποθήκευση & καταχώρηση',
    'Cancel': 'Άκυρο',
    'Sort': 'Ταξινόμηση',
    'Recent': 'Πρόσφατα',
    'Amount': 'Ποσό',
    'Open': 'Άνοιγμα',
    'Workflow designer': 'Σχεδιαστής ροής',
    'Add user': 'Προσθήκη χρήστη',
    'Advanced filter': 'Σύνθετο φίλτρο',
    'Export log': 'Εξαγωγή αρχείου',
    'View audit trail': 'Προβολή ιστορικού ελέγχου',

    // Dashboard
    'Good morning, Elena': 'Καλημέρα, Έλενα',
    "Thursday, 29 May 2026 · Here's what needs your attention across the portal.":
      'Πέμπτη, 29 Μαΐου 2026 · Δείτε τι χρειάζεται την προσοχή σας στην πύλη.',
    'Documents captured': 'Έγγραφα που καταχωρήθηκαν',
    'Invoices pending': 'Τιμολόγια σε εκκρεμότητα',
    'Awaiting your approval': 'Αναμένουν την έγκρισή σας',
    'Avg. processing time': 'Μέσος χρόνος επεξεργασίας',
    'this month': 'αυτόν τον μήνα',
    'vs. yesterday': 'σε σχέση με χθες',
    '2 high priority': '2 υψηλής προτεραιότητας',
    '22% faster': '22% ταχύτερα',
    'Workflow tasks': 'Εργασίες ροής',
    'Invoices currently at each task': 'Τιμολόγια ανά εργασία αυτή τη στιγμή',
    'Invoice status': 'Κατάσταση τιμολογίων',
    'Capture volume': 'Όγκος καταχώρησης',
    'Documents ingested this week': 'Έγγραφα που εισήχθησαν αυτή την εβδομάδα',
    'Week': 'Εβδομάδα',
    'Month': 'Μήνας',
    'Stock vs Non-stock': 'Απόθεμα έναντι Μη-αποθέματος',
    'Indexed invoices · this month': 'Καταχωρημένα τιμολόγια · αυτόν τον μήνα',
    'Needs your attention': 'Χρειάζονται προσοχή',
    'items': 'στοιχεία',
    '6 invoices awaiting your approval': '6 τιμολόγια αναμένουν την έγκρισή σας',
    '2 are high priority · oldest 2 days': '2 υψηλής προτεραιότητας · παλαιότερο 2 ημερών',
    'invoices with exceptions': 'τιμολόγια με εξαιρέσεις',
    'PO mismatch & duplicate detection': 'Ασυμφωνία ΠΑ & εντοπισμός διπλότυπων',
    '4 documents need manual review': '4 έγγραφα χρειάζονται χειροκίνητο έλεγχο',
    'Low OCR confidence on key fields': 'Χαμηλή αξιοπιστία OCR σε βασικά πεδία',
    '3 approvals approaching SLA': '3 εγκρίσεις πλησιάζουν το SLA',
    'Due within 24 hours': 'Λήγουν εντός 24 ωρών',
    'Recent activity': 'Πρόσφατη δραστηριότητα',
    'Healthy': 'Υγιές',

    // Page subtitles
    'Ingest, classify, and extract data from incoming documents across all channels.':
      'Εισαγωγή, ταξινόμηση και εξαγωγή δεδομένων από εισερχόμενα έγγραφα.',
    'Capture documents and index the fields needed to store them.':
      'Καταχωρήστε έγγραφα και ευρετηριάστε τα πεδία που απαιτούνται για αποθήκευση.',
    'Review extracted data, resolve exceptions, and route invoices for approval.':
      'Ελέγξτε τα εξαγόμενα δεδομένα, επιλύστε εξαιρέσεις και δρομολογήστε τιμολόγια για έγκριση.',
    'Invoice approval workflows — track and action in-flight items.':
      'Ροές έγκρισης τιμολογίων — παρακολούθηση και ενέργειες σε ενεργά στοιχεία.',
    'Operational insight across capture, processing, and approvals.':
      'Λειτουργική εικόνα σε καταχώρηση, επεξεργασία και εγκρίσεις.',
    'Immutable, time-stamped log of every action across the portal.':
      'Αμετάβλητο, χρονοσημασμένο αρχείο κάθε ενέργειας στην πύλη.',
    'Manage users, roles, and access across the Photiades portal.':
      'Διαχείριση χρηστών, ρόλων και πρόσβασης στην πύλη Photiades.',

    // Misc tab/status terms
    'All': 'Όλα',
    'Awaiting Approval': 'Αναμονή έγκρισης',
    'In Review': 'Σε έλεγχο',
    'Exception': 'Εξαίρεση',
    'At AcDep': 'Στο Λογιστήριο',
    'Paid Invoice': 'Εξοφλημένο τιμολόγιο',
    'Total outstanding': 'Σύνολο σε εκκρεμότητα',
    'Pending payment': 'Εκκρεμεί πληρωμή',
    'Paid invoices': 'Εξοφλημένα τιμολόγια',
  },
};

/** Pure translation lookup. Falls back to the English source string. */
export function translate(lang: Lang, s: string): string {
  if (lang === 'en') return s;
  const dict = TRANSLATIONS[lang];
  return dict && dict[s] != null ? dict[s] : s;
}

/** Hook returning a `tr` function bound to the current language.
    Re-renders consumers whenever the language changes. */
export function useTr(): (s: string) => string {
  const { t } = useTheme();
  return useCallback((s: string) => translate(t.lang, s), [t.lang]);
}
