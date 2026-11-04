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
    en: "Last updated: 4 November 2026",
    no: "Sist oppdatert: 4. november 2026",
  },
  intro: [
    {
      en: "This privacy policy explains how Otman AS collects, uses, stores, and protects personal data when you use our website, contact us, request transport services, or use our customer and operations platform.",
      no: "Denne personvernerklaeringen forklarer hvordan Otman AS samler inn, bruker, lagrer og beskytter personopplysninger naar du bruker nettsiden, kontakter oss, ber om transporttjenester eller bruker kunde- og driftsplattformen vaar.",
    },
    {
      en: "Otman AS is the data controller for the personal data described in this policy.",
      no: "Otman AS er behandlingsansvarlig for personopplysningene som er beskrevet i denne erklaeringen.",
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
          en: "Otman AS, org. no. 926425293, Skedsmokorset, Gneisveien 8, 2020.",
          no: "Otman AS, org.nr. 926425293, Skedsmokorset, Gneisveien 8, 2020.",
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
          en: "Payment details for orders paid on the website: amounts, dates, and payment references from Stripe. Card details are entered on Stripe's payment page and are never stored by us.",
          no: "Betalingsopplysninger for bestillinger betalt paa nettsiden: beloep, datoer og betalingsreferanser fra Stripe. Kortopplysninger legges inn paa Stripes betalingsside og lagres aldri hos oss.",
        },
        {
          en: "Files and photos you upload with an order, such as pickup receipts or pictures of items.",
          no: "Filer og bilder du laster opp med en bestilling, for eksempel hentekvitteringer eller bilder av varer.",
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
          en: "Stripe (card payments for website orders).",
          no: "Stripe (kortbetaling for bestillinger paa nettsiden).",
        },
        {
          en: "Google (Gmail, for order emails), Brevo (password resets and bulk emails), and Cloudflare (routing of email replies).",
          no: "Google (Gmail, for ordre-e-poster), Brevo (tilbakestilling av passord og masseutsendelser) og Cloudflare (videresending av e-postsvar).",
        },
        {
          en: "GatewayAPI (SMS about your order).",
          no: "GatewayAPI (SMS om bestillingen din).",
        },
        {
          en: "Mapbox (address search and driving distance).",
          no: "Mapbox (adressesoek og kjoereavstand).",
        },
        {
          en: "GSM Tasks (planning and documenting deliveries, including proof of delivery).",
          no: "GSM Tasks (planlegging og dokumentasjon av leveranser, inkludert leveringsbekreftelse).",
        },
        {
          en: "Amazon Web Services, Stockholm region (storage of files and attachments), and our hosting and database providers.",
          no: "Amazon Web Services, region Stockholm (lagring av filer og vedlegg), og vaare leverandoerer av hosting og database.",
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
          en: "Some service providers, such as Stripe, Google, Cloudflare, and Mapbox, may process data outside Norway or the EEA, including in the USA. Where this happens, we rely on the EU-US Data Privacy Framework, EU standard contractual clauses, or other approved transfer mechanisms.",
          no: "Noen leverandoerer, som Stripe, Google, Cloudflare og Mapbox, kan behandle opplysninger utenfor Norge eller EOE, blant annet i USA. Naar dette skjer, bygger vi paa EU-US Data Privacy Framework, EUs standard kontraktsbestemmelser eller andre godkjente overfoeringsmekanismer.",
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
      items: [
        {
          en: "Orders placed on the website: your name, contact details, addresses, comments, messages, and uploaded files are anonymized or deleted 90 days after the order is completed, cancelled, declined, or rejected.",
          no: "Bestillinger paa nettsiden: navn, kontaktopplysninger, adresser, kommentarer, meldinger og opplastede filer anonymiseres eller slettes 90 dager etter at bestillingen er fullfoert, kansellert, avslaatt eller avvist.",
        },
        {
          en: "Business orders: the end customer's personal data is anonymized 30 days after the order is paid, and proof-of-delivery files are deleted after 6 months.",
          no: "Bedriftsoppdrag: sluttkundens personopplysninger anonymiseres 30 dager etter at oppdraget er betalt, og leveringsbekreftelser slettes etter 6 maaneder.",
        },
        {
          en: "The temporary \"My order\" login is deleted one day after all your orders are finished.",
          no: "Den midlertidige innloggingen til \"Min bestilling\" slettes en dag etter at alle bestillingene dine er avsluttet.",
        },
        {
          en: "Amounts, products, dates, payments, refunds, and invoices are kept as accounting records for the period required by the Norwegian Bookkeeping Act, normally 5 years.",
          no: "Beloep, varer, datoer, betalinger, tilbakebetalinger og fakturaer oppbevares som regnskapsmateriale i perioden bokfoeringsloven krever, normalt 5 aar.",
        },
        {
          en: "If an order is part of a complaint, insurance case, or dispute, we may keep the data until the case is closed.",
          no: "Dersom en bestilling er del av en reklamasjon, forsikringssak eller tvist, kan vi beholde opplysningene til saken er avsluttet.",
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
          en: "Our website and platform only use necessary cookies: to keep you logged in to the dashboard or \"My order\", remember preferences, and protect forms. We do not use cookies for analytics or marketing, and we do not use cookies to sell personal data.",
          no: "Nettsiden og plattformen vaar bruker bare noedvendige informasjonskapsler: for aa holde deg innlogget i dashbordet eller \"Min bestilling\", huske preferanser og beskytte skjemaer. Vi bruker ikke informasjonskapsler til analyse eller markedsfoering, og vi bruker ikke informasjonskapsler til aa selge personopplysninger.",
        },
        {
          en: "When you pay, you are sent to Stripe's payment page, where Stripe sets its own cookies to process the payment and prevent fraud, under Stripe's privacy policy.",
          no: "Naar du betaler, sendes du til Stripes betalingsside, der Stripe setter egne informasjonskapsler for aa gjennomfoere betalingen og hindre svindel, etter Stripes personvernerklaering.",
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
    en: "Last updated: 4 November 2026",
    no: "Sist oppdatert: 4. november 2026",
  },
  intro: [
    {
      en: "These general terms apply to freight assignments ordered from Otman AS. They are based on the company's lawyer-prepared terms dated 5 September 2025.",
      no: "Disse alminnelige vilkaarene gjelder for fraktoppdrag bestilt hos Otman AS. De bygger paa selskapets advokatutarbeidede vilkaar datert 5. september 2025.",
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
          en: "Otman AS, org. no. 926425293, Skedsmokorset, Gneisveien 8, 2020. Contact: info@otman.no, +47 402 84 977.",
          no: "Otman AS, org.nr. 926425293, Skedsmokorset, Gneisveien 8, 2020. Kontakt: info@otman.no, +47 402 84 977.",
        },
      ],
    },
    {
      title: {
        en: "Scope",
        no: "Anvendelsesomraade",
      },
      paragraphs: [
        {
          en: "These terms apply when ordering freight assignments from Otman AS.",
          no: "Disse vilkaarene kommer til anvendelse ved bestilling av fraktoppdrag hos Otman AS.",
        },
      ],
    },
    {
      title: {
        en: "Booking and order confirmation",
        no: "Bestilling og oppdragsbekreftelse",
      },
      paragraphs: [
        {
          en: "All assignments with Otman are carried out in accordance with the Norwegian Road Carriage Contracts Act and NSAB 2015. If there is a conflict, specifically agreed terms apply first, these general terms apply second, and NSAB 2015 applies after that.",
          no: "Alle oppdrag hos Otman utfoeres i henhold til vegfraktloven og NSAB 2015. Ved motstrid gaar saerskilt avtalte vilkaar foran Otman sine alminnelige vilkaar, og de alminnelige vilkaarene gaar foran NSAB 2015.",
        },
        {
          en: "Booking is made on Otman's website or by phone. After receiving a booking, Otman issues an order confirmation describing the assignment and its scope.",
          no: "Bestilling skjer paa Otman sin nettside eller per telefon. Etter mottatt bestilling utstedes en oppdragsbekreftelse. Oppdragsbekreftelsen inneholder en beskrivelse av oppdraget og dets omfang.",
        },
      ],
    },
    {
      title: {
        en: "Prices and price adjustments",
        no: "Priser og prisjusteringer",
      },
      paragraphs: [
        {
          en: "Otman's prices are set out in the price list that applies at any time and is available on https://otman.no/. General price adjustments are made at the start of the fourth quarter each year. The customer is encouraged to stay updated on Otman's current price lists.",
          no: "Otman sine priser fremkommer av den til enhver tid gjeldende prislisten paa https://otman.no/. Alminnelige prisjusteringer skjer ved inngangen av fjerde kvartal hvert aar. Kunden oppfordres til aa holde seg oppdatert paa Otman sine gjeldende prislister.",
        },
      ],
    },
    {
      title: {
        en: "Payment terms",
        no: "Betalingsvilkaar",
      },
      paragraphs: [
        {
          en: "Orders placed and paid by card on the website follow the section on website orders below. For other assignments, an invoice is issued when the assignment has been completed. Unless otherwise agreed, the assignment is invoiced with a 14-day payment deadline. The invoice will clearly describe the service delivered and state when and where it was performed. Supporting documentation is provided on request.",
          no: "Bestillinger som er bestilt og betalt med kort paa nettsiden foelger punktet om bestillinger paa nettsiden nedenfor. For andre oppdrag utstedes faktura naar oppdraget er utfoert. Med mindre annet er avtalt, faktureres oppdraget med 14 dagers betalingsfrist. Fakturaen vil ha en tydelig beskrivelse av tjenesten som ble levert, og oppgi naar og hvor den ble utfoert. Underlag oversendes paa forespoersel.",
        },
        {
          en: "The deadline for objections to an invoice is the same as the invoice payment deadline. The customer may not set off claims against Otman unless Otman accepts this. In case of late payment, statutory late-payment interest accrues from the due date under section 2 of the Norwegian Late Payment Interest Act.",
          no: "Fristen for aa komme med innsigelser paa fakturaen tilsvarer fakturaens betalingsfrist. Kunden kan ikke motregne i krav paa Otman sin haand med mindre dette aksepteres av Otman. Ved forsinket betaling paaloeper lovens forsinkelsesrente fra forfall i henhold til forsinkelsesrenteloven paragraf 2.",
        },
      ],
    },
    {
      title: {
        en: "Orders placed on the website",
        no: "Bestillinger paa nettsiden",
      },
      paragraphs: [
        {
          en: "The price shown before you confirm your order is the price you pay, including VAT. You pay by card through our payment provider Stripe when you place the order. If the payment is not completed within about 30 minutes, the order is cancelled automatically.",
          no: "Prisen som vises foer du bekrefter bestillingen, er prisen du betaler, inkludert mva. Du betaler med kort gjennom betalingsleverandoeren vaar Stripe naar du bestiller. Blir betalingen ikke fullfoert innen ca. 30 minutter, kanselleres bestillingen automatisk.",
        },
        {
          en: "We review every order and confirm it. If we cannot carry out the order, we decline it and refund the full amount to your card.",
          no: "Vi gaar gjennom og bekrefter hver bestilling. Dersom vi ikke kan utfoere bestillingen, avslaar vi den og tilbakebetaler hele beloepet til kortet ditt.",
        },
        {
          en: "If the order is changed after you have paid, by you in \"My order\" or by us in agreement with you, and the price goes up, you receive a link by email to pay the difference. If the price goes down, the difference is refunded to your card. Refunds normally reach your account within 5 to 10 business days.",
          no: "Dersom bestillingen endres etter at du har betalt, av deg i \"Min bestilling\" eller av oss etter avtale med deg, og prisen oeker, faar du en lenke paa e-post for aa betale mellomlegget. Gaar prisen ned, tilbakebetales mellomlegget til kortet ditt. Tilbakebetalinger er normalt paa kontoen din innen 5 til 10 virkedager.",
        },
        {
          en: "After payment you receive an order confirmation by email. Questions about a payment or a refund can be sent to info@otman.no.",
          no: "Etter betaling faar du en ordrebekreftelse paa e-post. Spoersmaal om en betaling eller tilbakebetaling kan sendes til info@otman.no.",
        },
      ],
    },
    {
      title: {
        en: "Lien in goods",
        no: "Tilbakeholdsrett",
      },
      paragraphs: [
        {
          en: "Otman reserves the right to retain freighted goods if the customer does not pay overdue invoices, in accordance with NSAB section 14.",
          no: "Otman forbeholder seg tilbakeholdsrett i fraktet gods dersom kunden ikke gjoer opp forfalte fakturaer i henhold til NSAB paragraf 14.",
        },
      ],
    },
    {
      title: {
        en: "Changes, additions, and incorrect information",
        no: "Endringer, tillegg og feil informasjon",
      },
      paragraphs: [
        {
          en: "If an assignment causes special costs that are not covered by Otman's price list, Otman reserves the right to require additional payment to cover those costs.",
          no: "Dersom oppdraget medfoerer saerskilte kostnader som ikke dekkes av Otman sin prisliste, forbeholder Otman seg retten til aa kreve tillegg for aa dekke disse.",
        },
        {
          en: "The customer must provide correct information to Otman when ordering. If the customer gives incorrect or incomplete information when ordering an assignment, Otman reserves the right to reject the assignment, stop performance of the assignment, and/or invoice additional remuneration and costs.",
          no: "Kunden er forpliktet til aa gi riktig informasjon til Otman ved bestilling. Dersom kunden gir uriktig eller ufullstendig informasjon ved bestilling av et oppdrag, forbeholder Otman seg retten til aa avvise oppdraget, stanse oppdragsutfoerelsen og/eller fakturere tilleggsvederlag og kostnader.",
        },
        {
          en: "If fuel prices, public charges, tolls, ferry costs, or other costs for Otman when carrying out the assignment increase by 15% or more, Otman has the right to require renegotiation of the remuneration for the agreed assignment.",
          no: "Ved en oekning paa 15% eller mer i drivstoffpriser, offentlige avgifter, bom, fergekostnader og andre kostnader for Otman ved utfoerelsen av oppdraget, har Otman rett til aa kreve reforhandling av vederlaget for det inngaate oppdraget.",
        },
      ],
    },
    {
      title: {
        en: "Liability and performance of assignments",
        no: "Forpliktelser, ansvar og utfoerelse av oppdrag",
      },
      paragraphs: [
        {
          en: "The customer is made aware that Otman's liability for damage during domestic road transport is limited to 8.33 SDR under NSAB 2015 section 21. In any event, liability is limited to an amount equal to the remuneration for the assignment. The customer is encouraged to take out transport insurance when shipping valuable goods.",
          no: "Kunden gjoeres oppmerksom paa at Otman sitt erstatningsansvar ved skade under innenlands veitransport er begrenset til 8,33 SDR i henhold til NSAB 2015 paragraf 21. Ansvaret er uansett begrenset til et beloep lik vederlaget for oppdraget. Kunden oppfordres til aa tegne transportforsikring ved frakt av dyre varer.",
        },
      ],
    },
    {
      title: {
        en: "Breach",
        no: "Mislighold",
      },
      paragraphs: [
        {
          en: "If a party does not fulfil its obligations under the agreement, this constitutes breach. The breaching party must remedy the breach without undue delay after receiving a written demand from the other party.",
          no: "Dersom en part ikke oppfyller sine forpliktelser etter avtalen, foreligger mislighold. Den misligholdende part plikter aa rette misligholdet uten ugrunnet opphold etter aa ha mottatt skriftlig paakrav fra den andre parten.",
        },
      ],
    },
    {
      title: {
        en: "Complaints",
        no: "Reklamasjon",
      },
      paragraphs: [
        {
          en: "Complaints must be made in writing to Otman's stated email address. A complaint must include the following information:",
          no: "Reklamasjoner skal skje skriftlig til Otman sin oppgitte e-postadresse. Reklamasjonen maa inneholde foelgende opplysninger:",
        },
      ],
      items: [
        {
          en: "Order number.",
          no: "Ordrenummer.",
        },
        {
          en: "Contact person.",
          no: "Kontaktperson.",
        },
        {
          en: "Transport date.",
          no: "Transportdato.",
        },
        {
          en: "Which goods are damaged, where they are located, the cause of damage, and pictures of the goods.",
          no: "Hvilket gods som er skadet, hvor det befinner seg, skadeaarsak og bilder av varene.",
        },
        {
          en: "Copy of the consignment note and commercial invoice.",
          no: "Kopi av fraktbrev og handelsfaktura.",
        },
        {
          en: "Complaints must be made immediately for visible damage and within 7 days for hidden damage, cf. NSAB section 27.",
          no: "Reklamasjon maa finne sted umiddelbart ved synlige skader, og innen 7 dager ved skjulte skader, jf. NSAB paragraf 27.",
        },
      ],
    },
    {
      title: {
        en: "Compensation",
        no: "Erstatning",
      },
      paragraphs: [
        {
          en: "The affected party may claim compensation for documented loss resulting from the breach, subject to the limitations that follow from NSAB 2015 and the Norwegian Road Carriage Contracts Act as described in the liability section above.",
          no: "Den beroerte part kan kreve erstattet dokumentert tap som foelge av misligholdet, med de begrensninger som foelger av NSAB 2015 og lov om vegfraktavtaler i henhold til punktet om ansvar over.",
        },
      ],
    },
    {
      title: {
        en: "Termination",
        no: "Heving",
      },
      paragraphs: [
        {
          en: "If the breach constitutes a material breach of contract, the affected party may terminate the assignment with immediate effect. Termination must be made in writing within a reasonable time after the affected party became, or should have become, aware of the breach.",
          no: "Dersom misligholdet innebaerer et vesentlig kontraktsbrudd, kan den beroerte part heve oppdraget med umiddelbar virkning. Heving maa skje skriftlig innen rimelig tid etter at den beroerte part fikk eller burde faatt kunnskap om misligholdet.",
        },
        {
          en: "The right to terminate lapses if the termination notice is not given within such deadline, unless the breaching party has acted with gross negligence or contrary to honesty and good faith.",
          no: "Retten til aa heve bortfaller dersom hevingsmelding ikke gis innen slik frist, med mindre den misligholdende part har opptraadt grovt uaktsomt eller i strid med redelighet og god tro.",
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
          en: "Otman cannot be held liable for delays, losses, or other compensable circumstances caused by circumstances outside its control. This includes weather conditions and natural disasters, extraordinary traffic challenges, technical problems on road and freight networks, strikes, and similar circumstances that Otman cannot reasonably be expected to overcome or prevent the effects of. The customer cannot claim a price reduction or compensation for consequences of force majeure.",
          no: "Otman kan ikke holdes ansvarlig for forsinkelser, tap eller andre erstatningsbetingende forhold som skyldes forhold utenfor dets kontroll. Dette gjelder blant annet vaerforhold og naturkatastrofer, ekstraordinaere trafikale utfordringer, tekniske problemer paa vei og godsnett, streik osv., som Otman ikke med rimelighet kan forventes aa overvinne eller forhindre virkningene av. Kunden kan heller ikke kreve prisavslag eller erstatning for konsekvenser av force majeure.",
        },
      ],
    },
    {
      title: {
        en: "Cancellation",
        no: "Avbestilling",
      },
      paragraphs: [
        {
          en: "The customer may cancel the assignment in whole or in part by written notice to Otman. Cancellation must take place no later than 48 hours before the assignment is to be carried out. If cancellation is made later than this, the customer will be charged a cancellation fee equal to 40% of the assignment remuneration.",
          no: "Kunden kan avbestille oppdraget helt eller delvis ved skriftlig melding til Otman. Avbestilling maa senest skje 48 timer foer oppdraget skal finne sted. Ved avbestilling senere enn dette vil kunden bli belastet et bruddgebyr tilsvarende 40% av oppdragets vederlag.",
        },
        {
          en: "For an order paid on the website, contact us by phone (+47 402 84 977) or email (info@otman.no) to cancel. If you cancel at least 48 hours before the assignment, we refund the full amount. If you cancel later, the cancellation fee above is kept and the rest is refunded to your card.",
          no: "For en bestilling som er betalt paa nettsiden, kontakter du oss paa telefon (+47 402 84 977) eller e-post (info@otman.no) for aa avbestille. Avbestiller du senest 48 timer foer oppdraget, tilbakebetaler vi hele beloepet. Avbestiller du senere, beholdes bruddgebyret over, og resten tilbakebetales til kortet ditt.",
        },
        {
          en: "If we arrive as agreed but the assignment cannot be carried out for reasons on the customer's side, for example because no one is home, there is no access, or the information given was wrong, we may charge a fee for the wasted trip according to the price list.",
          no: "Dersom vi kommer som avtalt, men oppdraget ikke kan utfoeres av aarsaker paa kundens side, for eksempel fordi ingen er hjemme, det ikke er adkomst eller opplysningene som ble gitt var feil, kan vi kreve et gebyr for bomtur etter prislisten.",
        },
      ],
    },
    {
      title: {
        en: "Right of withdrawal",
        no: "Angrerett",
      },
      paragraphs: [
        {
          en: "For consumer purchases, the provisions of the Norwegian Right of Withdrawal Act apply in the ordinary way.",
          no: "I forbrukerkjoep kommer angrerettlovens bestemmelser til anvendelse paa alminnelig maate.",
        },
        {
          en: "Transport of goods, such as delivery, collection, and moving on an agreed date, has no right of withdrawal, cf. section 22 of the Right of Withdrawal Act. The cancellation rules above apply instead.",
          no: "Godstransport, som levering, henting og flytting paa en avtalt dato, har ikke angrerett, jf. angrerettloven paragraf 22. Avbestillingsreglene over gjelder i stedet.",
        },
        {
          en: "For other services, such as installation, mounting, and assembly, you have a 14-day right of withdrawal from the day the agreement is made. If you ask us to carry out the service within those 14 days and then withdraw, you pay for the part that has been carried out. Once the service has been fully carried out at your request, the right of withdrawal no longer applies.",
          no: "For andre tjenester, som installasjon, montering og sammenstilling, har du 14 dagers angrerett fra avtalen inngaas. Ber du oss utfoere tjenesten innen de 14 dagene og deretter angrer, betaler du for den delen som er utfoert. Naar tjenesten er fullt utfoert etter ditt oenske, gjelder ikke angreretten lenger.",
        },
        {
          en: "To use the right of withdrawal, tell us clearly by email (info@otman.no) or phone before the deadline. You can use the standard withdrawal form, which we send on request. We refund what you are owed within 14 days, to the card you paid with.",
          no: "For aa bruke angreretten gir du oss tydelig beskjed paa e-post (info@otman.no) eller telefon innen fristen. Du kan bruke standard angreskjema, som vi sender paa forespoersel. Vi tilbakebetaler det du har krav paa innen 14 dager, til kortet du betalte med.",
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
