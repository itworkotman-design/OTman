export type Locale = "en" | "no";

export type LocalizedText = Record<Locale, string>;

export type LegalSection = {
  title: LocalizedText;
  paragraphs: LocalizedText[];
  items?: LocalizedText[];
};

export type LegalPageContent = {
  title: LocalizedText;
  lastUpdated: LocalizedText;
  intro: LocalizedText[];
  sections: LegalSection[];
};

export const privacyPolicyContent: LegalPageContent = {
  title: {
    en: "Privacy policy",
    no: "Personvernerklaering",
  },
  lastUpdated: {
    en: "Last updated: 5 June 2026",
    no: "Sist oppdatert: 5. juni 2026",
  },
  intro: [
    {
      en: "This privacy policy explains how Otman Transport AS collects, uses, stores, and protects personal data when you use our website, contact us, request transport services, or use our customer and operations platform.",
      no: "Denne personvernerklaeringen forklarer hvordan Otman Transport AS samler inn, bruker, lagrer og beskytter personopplysninger naar du bruker nettsiden, kontakter oss, ber om transporttjenester eller bruker kunde- og driftsplattformen vaar.",
    },
    {
      en: "Otman Transport AS is the data controller for the personal data described in this policy.",
      no: "Otman Transport AS er behandlingsansvarlig for personopplysningene som er beskrevet i denne erklaeringen.",
    },
  ],
  sections: [
    {
      title: {
        en: "Controller and contact details",
        no: "Behandlingsansvarlig og kontaktinformasjon",
      },
      paragraphs: [
        {
          en: "Otman Transport AS, org. no. 926425293, Kjeller, Nittebergsvingen 8, 2007.",
          no: "Otman Transport AS, org.nr. 926425293, Kjeller, Nittebergsvingen 8, 2007.",
        },
        {
          en: "For privacy questions, contact us at info@otman.no or +47 402 84 977.",
          no: "For spoersmaal om personvern kan du kontakte oss paa info@otman.no eller +47 402 84 977.",
        },
      ],
    },
    {
      title: {
        en: "Personal data we collect",
        no: "Personopplysninger vi samler inn",
      },
      paragraphs: [
        {
          en: "The information we collect depends on how you use our services.",
          no: "Hvilke opplysninger vi samler inn avhenger av hvordan du bruker tjenestene vaare.",
        },
      ],
      items: [
        {
          en: "Contact details such as name, company name, email address, phone number, and address.",
          no: "Kontaktopplysninger som navn, firmanavn, e-postadresse, telefonnummer og adresse.",
        },
        {
          en: "Transport and booking details such as pickup address, delivery address, return address, delivery date, time window, product or item details, customer comments, order notes, and service selections.",
          no: "Transport- og bestillingsopplysninger som henteadresse, leveringsadresse, returadresse, leveringsdato, tidsvindu, produkt- eller vareinformasjon, kundekommentarer, ordrenotater og valgte tjenester.",
        },
        {
          en: "Operational details such as driver information, subcontractor details, license plate, route distance, status updates, deviations, and proof-of-delivery or receipt attachments where relevant.",
          no: "Driftsopplysninger som sjaafoerinfo, underleverandoerinfo, registreringsnummer, ruteavstand, statusoppdateringer, avvik og vedlegg som kvitteringer eller leveringsbekreftelser der dette er relevant.",
        },
        {
          en: "Account details for platform users, including email, password hash, role, permissions, company membership, session records, language preference, profile details, and invite or password reset records.",
          no: "Kontoopplysninger for plattformbrukere, inkludert e-post, passordhash, rolle, tilganger, selskapsmedlemskap, sesjonslogger, spraakvalg, profildetaljer og invitasjons- eller passordtilbakestillingslogger.",
        },
        {
          en: "Technical and security data such as hashed IP address, hashed user agent, authentication events, rate-limit records, file metadata, and integration logs.",
          no: "Tekniske data og sikkerhetsdata som hashet IP-adresse, hashet brukeragent, autentiseringshendelser, rate-limit-logger, filmetadata og integrasjonslogger.",
        },
        {
          en: "Messages sent to or from us, including contact form messages, order emails, inbound email replies, and notification history.",
          no: "Meldinger sendt til eller fra oss, inkludert kontaktskjema, ordre-e-poster, innkommende e-postsvar og varslingshistorikk.",
        },
      ],
    },
    {
      title: {
        en: "Why we use personal data",
        no: "Hvorfor vi bruker personopplysninger",
      },
      paragraphs: [
        {
          en: "We use personal data to respond to inquiries, provide quotes, create and manage transport or manpower assignments, coordinate deliveries, communicate with customers and partners, handle attachments and proof of delivery, operate user accounts, secure the platform, maintain accounting and business records, and improve our services.",
          no: "Vi bruker personopplysninger for aa svare paa henvendelser, gi tilbud, opprette og administrere transport- eller bemanningsoppdrag, koordinere leveranser, kommunisere med kunder og partnere, haandtere vedlegg og leveringsbekreftelser, drifte brukerkontoer, sikre plattformen, opprettholde regnskaps- og forretningsdokumentasjon og forbedre tjenestene vaare.",
        },
      ],
    },
    {
      title: {
        en: "Legal basis",
        no: "Behandlingsgrunnlag",
      },
      paragraphs: [
        {
          en: "We process personal data when it is necessary to perform a contract or take steps before entering into a contract, when we must comply with legal obligations such as accounting and tax requirements, when we have a legitimate interest in operating, securing, documenting, and improving our services, or when you have given consent where consent is required.",
          no: "Vi behandler personopplysninger naar det er noedvendig for aa oppfylle en avtale eller gjennomfoere tiltak foer avtaleinngaaelse, naar vi maa oppfylle rettslige forpliktelser som regnskaps- og skattekrav, naar vi har en berettiget interesse i aa drifte, sikre, dokumentere og forbedre tjenestene vaare, eller naar du har gitt samtykke der samtykke kreves.",
        },
      ],
    },
    {
      title: {
        en: "Sharing and processors",
        no: "Deling og databehandlere",
      },
      paragraphs: [
        {
          en: "We only share personal data when it is needed to deliver or administer our services, comply with the law, protect our rights, or operate our systems securely.",
          no: "Vi deler bare personopplysninger naar det er noedvendig for aa levere eller administrere tjenestene vaare, foelge loven, beskytte rettighetene vaare eller drifte systemene vaare sikkert.",
        },
      ],
      items: [
        {
          en: "Transport partners, subcontractors, drivers, customers, and warehouses when needed to complete an assignment.",
          no: "Transportpartnere, underleverandoerer, sjaafoerer, kunder og lager naar det er noedvendig for aa gjennomfoere et oppdrag.",
        },
        {
          en: "IT, hosting, storage, email, map, and operational integration providers that process data on our behalf.",
          no: "Leverandoerer av IT, hosting, lagring, e-post, kart og driftsintegrasjoner som behandler opplysninger paa vegne av oss.",
        },
        {
          en: "Public authorities, accountants, advisors, or insurers when required by law or necessary for legitimate business purposes.",
          no: "Offentlige myndigheter, regnskapsfoerere, raadgivere eller forsikringsselskap naar loven krever det eller det er noedvendig for legitime forretningsformaal.",
        },
      ],
    },
    {
      title: {
        en: "International transfers",
        no: "Overfoering utenfor EOE",
      },
      paragraphs: [
        {
          en: "Some service providers may process data outside Norway or the EEA. Where this happens, we use appropriate safeguards such as EU standard contractual clauses or other approved transfer mechanisms.",
          no: "Noen leverandoerer kan behandle opplysninger utenfor Norge eller EOE. Naar dette skjer, bruker vi egnede garantier som EUs standard kontraktsbestemmelser eller andre godkjente overfoeringsmekanismer.",
        },
      ],
    },
    {
      title: {
        en: "Storage and deletion",
        no: "Lagring og sletting",
      },
      paragraphs: [
        {
          en: "We keep personal data for as long as it is needed for the purpose it was collected, to complete assignments, document transactions, handle claims, secure the platform, and meet legal obligations. Accounting records are normally retained for the period required by Norwegian bookkeeping rules. Order data may be anonymized or deleted when it is no longer needed for operational, legal, or documentation purposes.",
          no: "Vi lagrer personopplysninger saa lenge det er noedvendig for formaalet de ble samlet inn for, for aa gjennomfoere oppdrag, dokumentere transaksjoner, haandtere krav, sikre plattformen og oppfylle rettslige forpliktelser. Regnskapsmateriale oppbevares normalt i perioden som kreves etter norske bokfoeringsregler. Ordredata kan anonymiseres eller slettes naar de ikke lenger er noedvendige for drift, lovkrav eller dokumentasjon.",
        },
      ],
    },
    {
      title: {
        en: "Security",
        no: "Sikkerhet",
      },
      paragraphs: [
        {
          en: "We use technical and organizational measures to protect personal data, including access controls, role-based permissions, session handling, password hashing, logging, file type and size restrictions, and secure storage for attachments.",
          no: "Vi bruker tekniske og organisatoriske tiltak for aa beskytte personopplysninger, inkludert tilgangskontroll, rollebaserte rettigheter, sesjonshaandtering, passordhashing, logging, filtype- og stoerrelsesbegrensninger og sikker lagring av vedlegg.",
        },
      ],
    },
    {
      title: {
        en: "Your rights",
        no: "Dine rettigheter",
      },
      paragraphs: [
        {
          en: "You may have the right to request access, correction, deletion, restriction, data portability, and objection to certain processing. If processing is based on consent, you can withdraw consent at any time. Requests are normally handled free of charge and within one month.",
          no: "Du kan ha rett til innsyn, retting, sletting, begrensning, dataportabilitet og aa protestere mot visse behandlinger. Dersom behandlingen bygger paa samtykke, kan du trekke samtykket tilbake naar som helst. Forespoersler behandles normalt gratis og innen en maaned.",
        },
        {
          en: "If you believe your privacy rights have been breached, contact us first. You also have the right to complain to the Norwegian Data Protection Authority, Datatilsynet.",
          no: "Hvis du mener at personvernrettighetene dine er brutt, boer du kontakte oss foerst. Du har ogsaa rett til aa klage til Datatilsynet.",
        },
      ],
    },
    {
      title: {
        en: "Cookies and similar technologies",
        no: "Informasjonskapsler og lignende teknologi",
      },
      paragraphs: [
        {
          en: "Our website and platform may use necessary cookies or similar technologies to keep the site working, maintain login sessions, remember preferences, protect forms, and improve reliability. We do not use cookies to sell personal data.",
          no: "Nettsiden og plattformen vaar kan bruke noedvendige informasjonskapsler eller lignende teknologi for aa holde siden fungerende, opprettholde innloggingssesjoner, huske preferanser, beskytte skjemaer og forbedre stabilitet. Vi bruker ikke informasjonskapsler til aa selge personopplysninger.",
        },
      ],
    },
    {
      title: {
        en: "Changes to this policy",
        no: "Endringer i denne erklaeringen",
      },
      paragraphs: [
        {
          en: "We may update this policy when our services, systems, or legal obligations change. The latest version will be available on this page.",
          no: "Vi kan oppdatere denne erklaeringen naar tjenestene, systemene eller rettslige forpliktelser endres. Nyeste versjon vil vaere tilgjengelig paa denne siden.",
        },
      ],
    },
  ],
};

export const termsContent: LegalPageContent = {
  title: {
    en: "Terms and conditions",
    no: "Vilkaar og betingelser",
  },
  lastUpdated: {
    en: "Last updated: 5 June 2026",
    no: "Sist oppdatert: 5. juni 2026",
  },
  intro: [
    {
      en: "These terms apply when you use the Otman Transport AS website, request an offer, book services, or use our customer and operations platform. Separate written agreements, order confirmations, or customer-specific price lists take priority if they conflict with these general terms.",
      no: "Disse vilkaarene gjelder naar du bruker nettsiden til Otman Transport AS, ber om tilbud, bestiller tjenester eller bruker kunde- og driftsplattformen vaar. Saerskilte skriftlige avtaler, ordrebekreftelser eller kundespesifikke prislister gaar foran dersom de er i konflikt med disse generelle vilkaarene.",
    },
  ],
  sections: [
    {
      title: {
        en: "Company details",
        no: "Firmainformasjon",
      },
      paragraphs: [
        {
          en: "Otman Transport AS, org. no. 926425293, Kjeller, Nittebergsvingen 8, 2007. Contact: info@otman.no, +47 402 84 977.",
          no: "Otman Transport AS, org.nr. 926425293, Kjeller, Nittebergsvingen 8, 2007. Kontakt: info@otman.no, +47 402 84 977.",
        },
      ],
    },
    {
      title: {
        en: "Services",
        no: "Tjenester",
      },
      paragraphs: [
        {
          en: "We provide transport, collection, package delivery, moving, custom transport, manpower support, and related logistics services for private and business customers. The exact scope, addresses, timing, pricing, and special requirements are agreed in the relevant offer or order confirmation.",
          no: "Vi tilbyr transport, henting, pakkelevering, flytting, spesialtransport, bemanning og tilknyttede logistikktjenester for privat- og bedriftskunder. Det konkrete omfanget, adresser, tidspunkt, pris og spesielle krav avtales i relevant tilbud eller ordrebekreftelse.",
        },
      ],
    },
    {
      title: {
        en: "Requests, offers, and bookings",
        no: "Forespoersler, tilbud og bestillinger",
      },
      paragraphs: [
        {
          en: "A request through the website or platform is not binding until we confirm the assignment or issue a written order confirmation. Offers are based on the information provided by the customer. If the information is incomplete or changes, price, timing, capacity, and availability may also change.",
          no: "En forespoersel via nettsiden eller plattformen er ikke bindende foer vi bekrefter oppdraget eller sender skriftlig ordrebekreftelse. Tilbud baseres paa opplysningene kunden gir. Dersom opplysningene er ufullstendige eller endres, kan pris, tidspunkt, kapasitet og tilgjengelighet ogsaa endres.",
        },
      ],
    },
    {
      title: {
        en: "Customer responsibilities",
        no: "Kundens ansvar",
      },
      paragraphs: [
        {
          en: "The customer must provide correct contact details, pickup and delivery addresses, access information, item descriptions, dimensions, weight, special handling needs, parking or building restrictions, and any other information needed to perform the assignment safely and efficiently.",
          no: "Kunden maa gi riktige kontaktopplysninger, hente- og leveringsadresser, tilgangsinformasjon, varebeskrivelser, maal, vekt, behov for spesialhaandtering, parkerings- eller bygningsbegrensninger og annen informasjon som trengs for aa utfoere oppdraget trygt og effektivt.",
        },
        {
          en: "Items must be properly packed unless packing is part of the agreed service. The customer is responsible for ensuring that the goods may legally be transported and that no prohibited, dangerous, or undeclared items are included.",
          no: "Varer maa vaere forsvarlig pakket med mindre pakking er en del av avtalt tjeneste. Kunden er ansvarlig for at godset lovlig kan transporteres, og at forbudte, farlige eller uoppgitte gjenstander ikke inngaar.",
        },
      ],
    },
    {
      title: {
        en: "Access, delays, and failed delivery",
        no: "Tilgang, forsinkelser og mislykket levering",
      },
      paragraphs: [
        {
          en: "The customer must ensure access at pickup and delivery locations within the agreed time window. Extra waiting time, failed access, incorrect addresses, changed instructions, additional stops, special lifting needs, or other added work may result in extra charges or rescheduling.",
          no: "Kunden maa sikre tilgang paa hente- og leveringssted innen avtalt tidsvindu. Ekstra ventetid, manglende tilgang, feil adresse, endrede instrukser, ekstra stopp, spesielle loeftebehov eller annet tilleggsarbeid kan medfoere ekstra kostnader eller ny avtale om tidspunkt.",
        },
      ],
    },
    {
      title: {
        en: "Prices and payment",
        no: "Priser og betaling",
      },
      paragraphs: [
        {
          en: "Prices are stated in the offer, order confirmation, platform, or applicable price list. Unless otherwise agreed, prices are exclusive of VAT for business customers and may include agreed additions such as extra work, returns, pallets, express handling, or manual adjustments.",
          no: "Priser fremgaar av tilbud, ordrebekreftelse, plattform eller gjeldende prisliste. Med mindre annet er avtalt, er priser ekskl. mva. for bedriftskunder og kan inkludere avtalte tillegg som ekstraarbeid, retur, pall, ekspresshaandtering eller manuelle justeringer.",
        },
        {
          en: "Invoices must be paid by the due date stated on the invoice. Late payment may result in statutory interest, reminder fees, collection costs, suspension of services, or account restrictions.",
          no: "Fakturaer maa betales innen forfallsdatoen som fremgaar av fakturaen. Forsinket betaling kan medfoere lovbestemt forsinkelsesrente, purregebyr, inkassokostnader, stans av tjenester eller begrensning av konto.",
        },
      ],
    },
    {
      title: {
        en: "Cancellation and changes",
        no: "Avbestilling og endringer",
      },
      paragraphs: [
        {
          en: "Cancellations or changes must be sent as soon as possible. If an assignment has already been planned, started, dispatched, or reserved with dedicated capacity, we may charge for incurred costs, used time, reserved capacity, or other documented losses.",
          no: "Avbestillinger eller endringer maa sendes saa tidlig som mulig. Dersom et oppdrag allerede er planlagt, startet, sendt ut eller reservert med dedikert kapasitet, kan vi fakturere paaloepte kostnader, brukt tid, reservert kapasitet eller andre dokumenterte tap.",
        },
      ],
    },
    {
      title: {
        en: "Damage, loss, and claims",
        no: "Skade, tap og reklamasjon",
      },
      paragraphs: [
        {
          en: "Visible damage, missing goods, or other delivery issues should be reported immediately and documented with photos, receipt information, order number, and a description of the issue. Claims must be submitted without undue delay so we can investigate.",
          no: "Synlig skade, manglende gods eller andre leveringsproblemer boer meldes umiddelbart og dokumenteres med bilder, kvitteringsinformasjon, ordrenummer og beskrivelse av problemet. Reklamasjoner maa sendes uten ugrunnet opphold slik at vi kan undersoeke saken.",
        },
        {
          en: "Our liability is limited to direct documented loss caused by our breach or negligence, unless mandatory law states otherwise. We are not liable for indirect losses, loss of profit, delays caused by circumstances outside our control, or damage caused by insufficient packaging, incorrect information, unavailable access, or the nature of the goods.",
          no: "Vaart ansvar er begrenset til direkte dokumentert tap foraarsaket av vaart avtalebrudd eller uaktsomhet, med mindre ufravikelig lov sier noe annet. Vi er ikke ansvarlige for indirekte tap, tapt fortjeneste, forsinkelser som skyldes forhold utenfor vaar kontroll, eller skade som skyldes mangelfull emballering, feil informasjon, manglende tilgang eller godsets egenart.",
        },
      ],
    },
    {
      title: {
        en: "Platform accounts",
        no: "Plattformkontoer",
      },
      paragraphs: [
        {
          en: "Users with access to the customer or operations platform must keep login details confidential and use the platform only for authorized business purposes. We may suspend or restrict access if we suspect misuse, security risk, non-payment, or breach of these terms.",
          no: "Brukere med tilgang til kunde- eller driftsplattformen maa holde innloggingsopplysninger konfidensielle og bare bruke plattformen til autoriserte forretningsformaal. Vi kan stanse eller begrense tilgang ved mistanke om misbruk, sikkerhetsrisiko, manglende betaling eller brudd paa disse vilkaarene.",
        },
      ],
    },
    {
      title: {
        en: "Third-party services",
        no: "Tredjepartstjenester",
      },
      paragraphs: [
        {
          en: "We may use third-party services for mapping, storage, email, route planning, subcontractor coordination, and delivery documentation. Availability and accuracy may depend on those providers, and we are not responsible for interruptions or errors outside our reasonable control.",
          no: "Vi kan bruke tredjepartstjenester for kart, lagring, e-post, ruteplanlegging, koordinering med underleverandoerer og leveringsdokumentasjon. Tilgjengelighet og noeyaktighet kan avhenge av disse leverandoerene, og vi er ikke ansvarlige for avbrudd eller feil utenfor vaar rimelige kontroll.",
        },
      ],
    },
    {
      title: {
        en: "Force majeure",
        no: "Force majeure",
      },
      paragraphs: [
        {
          en: "We are not liable for delay or failure caused by circumstances outside our reasonable control, including severe weather, traffic incidents, road closures, strikes, illness, power or network outages, public authority decisions, accidents, or supplier failures.",
          no: "Vi er ikke ansvarlige for forsinkelse eller manglende oppfyllelse som skyldes forhold utenfor vaar rimelige kontroll, inkludert ekstremvaer, trafikkhendelser, stengte veier, streik, sykdom, stroem- eller nettverksbrudd, offentlige paalegg, ulykker eller leverandoersvikt.",
        },
      ],
    },
    {
      title: {
        en: "Privacy",
        no: "Personvern",
      },
      paragraphs: [
        {
          en: "We process personal data as described in our privacy policy. By using the website, requesting services, or using the platform, you acknowledge that personal data may be processed to administer and deliver the services.",
          no: "Vi behandler personopplysninger som beskrevet i personvernerklaeringen vaar. Ved aa bruke nettsiden, be om tjenester eller bruke plattformen, erkjenner du at personopplysninger kan behandles for aa administrere og levere tjenestene.",
        },
      ],
    },
    {
      title: {
        en: "Governing law and disputes",
        no: "Lovvalg og tvister",
      },
      paragraphs: [
        {
          en: "These terms are governed by Norwegian law. Disputes should first be resolved through dialogue. If no solution is reached, disputes may be brought before the ordinary Norwegian courts unless mandatory law gives the customer another venue or complaint option.",
          no: "Disse vilkaarene er underlagt norsk rett. Tvister boer foerst soekes loest gjennom dialog. Dersom partene ikke kommer til en loesning, kan tvisten bringes inn for de ordinaere norske domstolene med mindre ufravikelig lov gir kunden et annet verneting eller klagealternativ.",
        },
      ],
    },
    {
      title: {
        en: "Changes to the terms",
        no: "Endringer i vilkaarene",
      },
      paragraphs: [
        {
          en: "We may update these terms when our services, pricing structure, platform, or legal requirements change. The latest version will be available on this page.",
          no: "Vi kan oppdatere disse vilkaarene naar tjenestene, prisstrukturen, plattformen eller lovkrav endres. Nyeste versjon vil vaere tilgjengelig paa denne siden.",
        },
      ],
    },
  ],
};
