import type {
  EventCategory,
  PersistedState,
  PlatformUser
} from "@/lib/tindereo-types";

export const APP_NAME = "Tindereo";
export const APP_TAGLINE = "Eventos que conectan antes de que empiecen";
export const ORGANIZER_CONTACT_EMAIL = "hola@tindereo.app";

export const EVENT_CATEGORY_META: Record<
  EventCategory,
  { label: string; accent: string; softAccent: string }
> = {
  music: {
    label: "Musica",
    accent: "#FF6B57",
    softAccent: "rgba(255, 107, 87, 0.16)"
  },
  networking: {
    label: "Networking",
    accent: "#F08A24",
    softAccent: "rgba(240, 138, 36, 0.16)"
  },
  food: {
    label: "Food",
    accent: "#C7702E",
    softAccent: "rgba(199, 112, 46, 0.16)"
  },
  creative: {
    label: "Creativo",
    accent: "#8A5CF6",
    softAccent: "rgba(138, 92, 246, 0.16)"
  },
  wellness: {
    label: "Wellness",
    accent: "#2AA876",
    softAccent: "rgba(42, 168, 118, 0.16)"
  }
};

export const EVENT_CATEGORY_OPTIONS = [
  { value: "all", label: "Todos" },
  { value: "music", label: "Musica" },
  { value: "networking", label: "Networking" },
  { value: "food", label: "Food" },
  { value: "creative", label: "Creativo" },
  { value: "wellness", label: "Wellness" }
] as const;

export const EVENT_COVER_BY_CATEGORY: Record<EventCategory, string> = {
  music:
    "https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?auto=format&fit=crop&w=1400&q=80",
  networking:
    "https://images.unsplash.com/photo-1511578314322-379afb476865?auto=format&fit=crop&w=1400&q=80",
  food:
    "https://images.unsplash.com/photo-1414235077428-338989a2e8c0?auto=format&fit=crop&w=1400&q=80",
  creative:
    "https://images.unsplash.com/photo-1517048676732-d65bc937f952?auto=format&fit=crop&w=1400&q=80",
  wellness:
    "https://images.unsplash.com/photo-1483721310020-03333e577078?auto=format&fit=crop&w=1400&q=80"
};

export const DEMO_USERS: PlatformUser[] = [
  {
    id: "lucia-serrano",
    name: "Lucia Serrano",
    handle: "@luciagoesout",
    role: "attendee",
    city: "Madrid",
    title: "Brand strategist",
    company: "North Studio",
    bio:
      "Me gustan los eventos con buen ritmo, gente curiosa y conversaciones que siguen despues del plan.",
    tagline: "Llego por el evento, me quedo por la comunidad.",
    avatar:
      "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=600&q=80",
    coverImage:
      "https://images.unsplash.com/photo-1517457373958-b7bdd4587205?auto=format&fit=crop&w=1400&q=80",
    interests: ["Rooftops", "Brand", "Wine bars", "Community", "House"],
    verified: true
  },
  {
    id: "mateo-rivas",
    name: "Mateo Rivas",
    handle: "@mateo.builds",
    role: "attendee",
    city: "Madrid",
    title: "Growth lead",
    company: "Itera Labs",
    bio:
      "Voy a eventos para conocer gente con energia, descubrir planes nuevos y salir con una idea mejor que cuando entre.",
    tagline: "Mucho social, poco postureo.",
    avatar:
      "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=600&q=80",
    coverImage:
      "https://images.unsplash.com/photo-1515169067868-5387ec356754?auto=format&fit=crop&w=1400&q=80",
    interests: ["Startups", "Running", "Brunch", "Tech", "Live music"],
    verified: false
  },
  {
    id: "ines-oliver",
    name: "Ines Oliver",
    handle: "@ineslayers",
    role: "attendee",
    city: "Barcelona",
    title: "Creative producer",
    company: "Frame House",
    bio:
      "Produzco experiencias de marca y me quedo siempre en los eventos donde la gente quiere hablar de verdad.",
    tagline: "Creatividad, gente bonita y cero conversaciones vacias.",
    avatar:
      "https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=600&q=80",
    coverImage:
      "https://images.unsplash.com/photo-1511578314322-379afb476865?auto=format&fit=crop&w=1400&q=80",
    interests: ["Creative direction", "Music", "Art", "Food", "Pop-ups"],
    verified: true
  },
  {
    id: "nora-costa",
    name: "Nora Costa",
    handle: "@noraonfilm",
    role: "attendee",
    city: "Lisboa",
    title: "Photographer",
    company: "Freelance",
    bio:
      "Me quedo donde hay buena luz, gente abierta y un plan que luego se pueda recordar con ganas.",
    tagline: "Camara en mano y radar social activado.",
    avatar:
      "https://images.unsplash.com/photo-1488426862026-3ee34a7d66df?auto=format&fit=crop&w=600&q=80",
    coverImage:
      "https://images.unsplash.com/photo-1492684223066-81342ee5ff30?auto=format&fit=crop&w=1400&q=80",
    interests: ["Photo walks", "Brunch", "Travel", "Community", "Indie pop"],
    verified: false
  },
  {
    id: "diego-luna",
    name: "Diego Luna",
    handle: "@diegospeaks",
    role: "attendee",
    city: "Valencia",
    title: "Founder",
    company: "Scene Ops",
    bio:
      "Soy de los que llega pronto, habla con todo el mundo y acaba proponiendo el siguiente plan antes de irse.",
    tagline: "Si hay energia buena, me apunto.",
    avatar:
      "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=600&q=80",
    coverImage:
      "https://images.unsplash.com/photo-1511795409834-ef04bbd61622?auto=format&fit=crop&w=1400&q=80",
    interests: ["Hospitality", "Angel investing", "Food", "Fitness", "Live sessions"],
    verified: true
  },
  {
    id: "sara-mora",
    name: "Sara Mora",
    handle: "@saramora.jpg",
    role: "attendee",
    city: "Madrid",
    title: "Art director",
    company: "Mono Studio",
    bio:
      "Busco eventos donde se mezclen creatividad, social y una excusa buena para salir del escritorio.",
    tagline: "Arte, gente afilada y planes que dejan huella.",
    avatar:
      "https://images.unsplash.com/photo-1487412720507-e7ab37603c6f?auto=format&fit=crop&w=600&q=80",
    coverImage:
      "https://images.unsplash.com/photo-1529156069898-49953e39b3ac?auto=format&fit=crop&w=1400&q=80",
    interests: ["Art", "Editorial", "Dinner clubs", "Creative tech", "House"],
    verified: false
  },
  {
    id: "clara-vidal",
    name: "Clara Vidal",
    handle: "@clarahosts",
    role: "organizer",
    city: "Madrid",
    title: "Head of Experiences",
    company: "After Social Club",
    bio:
      "Diseno eventos donde la conversacion empieza antes de llegar al venue y sigue mucho despues.",
    tagline: "Organizo experiencias pensadas para conectar.",
    avatar:
      "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?auto=format&fit=crop&w=600&q=80",
    coverImage:
      "https://images.unsplash.com/photo-1511578314322-379afb476865?auto=format&fit=crop&w=1400&q=80",
    interests: ["Community", "Music", "Operations", "Partnerships", "Hospitality"],
    verified: true
  },
  {
    id: "raul-ibarra",
    name: "Raul Ibarra",
    handle: "@raulbuildslive",
    role: "organizer",
    city: "Madrid",
    title: "Creative events lead",
    company: "Open Table Sessions",
    bio:
      "Me obsesiona que el evento empiece antes y acabe despues. Por eso el chat y la comunidad importan tanto como el venue.",
    tagline: "Produccion limpia, comunidad fuerte.",
    avatar:
      "https://images.unsplash.com/photo-1504593811423-6dd665756598?auto=format&fit=crop&w=600&q=80",
    coverImage:
      "https://images.unsplash.com/photo-1529156069898-49953e39b3ac?auto=format&fit=crop&w=1400&q=80",
    interests: ["Community design", "Partnerships", "Art", "Panels", "Food"],
    verified: true
  }
];

export const DEFAULT_STATE: PersistedState = {
  session: {
    currentUserId: "lucia-serrano",
    activeTab: "discover",
    selectedEventId: "after-solar-2026",
    selectedEventView: "overview",
    selectedPrivateChatId: "chat-lucia-ines"
  },
  users: DEMO_USERS,
  events: [
    {
      id: "after-solar-2026",
      slug: "after-solar-2026",
      title: "After Solar Rooftop Session",
      category: "music",
      city: "Madrid",
      venue: "La Marina Rooftop",
      coverImage:
        "https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?auto=format&fit=crop&w=1600&q=80",
      startsAt: "2026-06-19T20:30:00+02:00",
      endsAt: "2026-06-20T02:30:00+02:00",
      priceLabel: "Desde 18 EUR",
      capacity: 260,
      baseGuestCount: 142,
      waitlistCount: 18,
      hostId: "clara-vidal",
      summary: "Rooftop al atardecer con DJ set, mesa larga y grupo general para romper el hielo antes de llegar.",
      description:
        "Una noche pensada para mezclar musica, energia social y una comunidad que se activa dias antes. Cuando te unes, entras al chat general del evento para presentarte, ver quien va y proponer mini planes antes de subir.",
      highlights: [
        "Chat general activo desde el momento en que te unes",
        "Guest list con perfiles visibles para detectar afinidad",
        "Solicitud de chat privado entre asistentes"
      ],
      tags: ["Rooftop", "DJ set", "Comunidad", "Madrid", "Sunset"],
      dressCode: "Summer city",
      conversationPrompt:
        "Comparte en el chat general que te ha traido al evento y con que tipo de gente te gustaria conectar."
    },
    {
      id: "founders-brunch-circle",
      slug: "founders-brunch-circle",
      title: "Founders Brunch Circle",
      category: "networking",
      city: "Madrid",
      venue: "Casa Numa",
      coverImage:
        "https://images.unsplash.com/photo-1511578314322-379afb476865?auto=format&fit=crop&w=1600&q=80",
      startsAt: "2026-06-21T11:00:00+02:00",
      endsAt: "2026-06-21T14:30:00+02:00",
      priceLabel: "Reserva 24 EUR",
      capacity: 90,
      baseGuestCount: 48,
      waitlistCount: 6,
      hostId: "clara-vidal",
      summary: "Brunch curado para perfiles de producto, growth y operaciones que quieren conocerse antes del domingo.",
      description:
        "El objetivo no es intercambiar tarjetas. Es llegar al brunch habiendo abierto ya un par de conversaciones utiles y saber a quien quieres saludar primero.",
      highlights: [
        "Mesas de presentacion y dinamicas ligeras",
        "Chat general con prompts para romper el hielo",
        "Espacio para abrir chats privados post evento"
      ],
      tags: ["Brunch", "Networking", "Producto", "Founders"],
      dressCode: "Smart casual",
      conversationPrompt:
        "Cuenta en una frase que estas construyendo o que tipo de gente te gustaria conocer en el brunch."
    },
    {
      id: "design-night-lab",
      slug: "design-night-lab",
      title: "Design Night Lab",
      category: "creative",
      city: "Madrid",
      venue: "Taller Cero",
      coverImage:
        "https://images.unsplash.com/photo-1517048676732-d65bc937f952?auto=format&fit=crop&w=1600&q=80",
      startsAt: "2026-06-26T19:30:00+02:00",
      endsAt: "2026-06-26T23:30:00+02:00",
      priceLabel: "Invitacion + 12 EUR",
      capacity: 70,
      baseGuestCount: 27,
      waitlistCount: 0,
      hostId: "raul-ibarra",
      summary: "Mesa redonda, visuales y after para gente de diseño, contenido y direccion creativa.",
      description:
        "Un evento para perfiles visuales que quieren hablar con calma antes de verse. El chat general funciona como precalentamiento creativo y despues queda abierto el canal privado entre quien conecte.",
      highlights: [
        "Visual review en vivo y lightning talks",
        "Lista de asistentes con perfiles visibles",
        "Chats privados persistentes despues del evento"
      ],
      tags: ["Design", "Creative", "Visual culture", "Afterwork"],
      dressCode: "Expressive casual",
      conversationPrompt:
        "Presentate con la referencia visual o proyecto que mas te apetece comentar esa noche."
    },
    {
      id: "run-club-rio",
      slug: "run-club-rio",
      title: "Run Club Rio + Coffee",
      category: "wellness",
      city: "Madrid",
      venue: "Madrid Rio",
      coverImage:
        "https://images.unsplash.com/photo-1483721310020-03333e577078?auto=format&fit=crop&w=1600&q=80",
      startsAt: "2026-06-28T09:00:00+02:00",
      endsAt: "2026-06-28T11:30:00+02:00",
      priceLabel: "Gratis con RSVP",
      capacity: 120,
      baseGuestCount: 63,
      waitlistCount: 0,
      hostId: "raul-ibarra",
      summary: "Carrera suave, cafe y comunidad para gente que quiere socializar desde un plan mas ligero.",
      description:
        "Perfecto para conocer a la gente antes del domingo. Entras, te unes al chat general y ya sabes quien corre a tu ritmo o quien se apunta al cafe despues.",
      highlights: [
        "Pace groups de 5K y 8K",
        "Coffee social despues de correr",
        "Solicitud de chat privado entre asistentes"
      ],
      tags: ["Running", "Coffee", "Community", "Morning plans"],
      dressCode: "Sport casual",
      conversationPrompt:
        "Escribe tu ritmo, si te quedas al cafe y con quien te gustaria coincidir para conoceros."
    }
  ],
  memberships: [
    {
      id: "membership-after-lucia",
      eventId: "after-solar-2026",
      userId: "lucia-serrano",
      joinedAt: "2026-06-15T18:10:00+02:00"
    },
    {
      id: "membership-after-mateo",
      eventId: "after-solar-2026",
      userId: "mateo-rivas",
      joinedAt: "2026-06-15T18:20:00+02:00"
    },
    {
      id: "membership-after-ines",
      eventId: "after-solar-2026",
      userId: "ines-oliver",
      joinedAt: "2026-06-15T18:32:00+02:00"
    },
    {
      id: "membership-after-diego",
      eventId: "after-solar-2026",
      userId: "diego-luna",
      joinedAt: "2026-06-15T18:40:00+02:00"
    },
    {
      id: "membership-after-sara",
      eventId: "after-solar-2026",
      userId: "sara-mora",
      joinedAt: "2026-06-15T18:48:00+02:00"
    },
    {
      id: "membership-brunch-lucia",
      eventId: "founders-brunch-circle",
      userId: "lucia-serrano",
      joinedAt: "2026-06-15T12:08:00+02:00"
    },
    {
      id: "membership-brunch-ines",
      eventId: "founders-brunch-circle",
      userId: "ines-oliver",
      joinedAt: "2026-06-15T12:12:00+02:00"
    },
    {
      id: "membership-brunch-nora",
      eventId: "founders-brunch-circle",
      userId: "nora-costa",
      joinedAt: "2026-06-15T12:15:00+02:00"
    },
    {
      id: "membership-design-mateo",
      eventId: "design-night-lab",
      userId: "mateo-rivas",
      joinedAt: "2026-06-15T19:10:00+02:00"
    },
    {
      id: "membership-design-sara",
      eventId: "design-night-lab",
      userId: "sara-mora",
      joinedAt: "2026-06-15T19:20:00+02:00"
    },
    {
      id: "membership-run-diego",
      eventId: "run-club-rio",
      userId: "diego-luna",
      joinedAt: "2026-06-15T20:04:00+02:00"
    }
  ],
  groupMessages: [
    {
      id: "group-after-1",
      eventId: "after-solar-2026",
      authorId: "system",
      text: "El chat general ya esta abierto. Presentaos y decid con quien os gustaria coincidir al llegar.",
      kind: "system",
      createdAt: "2026-06-15T18:00:00+02:00"
    },
    {
      id: "group-after-2",
      eventId: "after-solar-2026",
      authorId: "mateo-rivas",
      text: "Yo llegare pronto. Si alguien quiere empezar en la terraza, me apunto.",
      kind: "text",
      createdAt: "2026-06-15T18:42:00+02:00"
    },
    {
      id: "group-after-3",
      eventId: "after-solar-2026",
      authorId: "lucia-serrano",
      text: "Busco gente que este mas por conocer y charlar un rato antes del set fuerte.",
      kind: "text",
      createdAt: "2026-06-15T18:46:00+02:00"
    },
    {
      id: "group-after-4",
      eventId: "after-solar-2026",
      authorId: "ines-oliver",
      text: "Yo voy con dos amigas un rato y luego me pierdo por la pista. Feliz de saludar a gente nueva.",
      kind: "text",
      createdAt: "2026-06-15T18:49:00+02:00"
    },
    {
      id: "group-brunch-1",
      eventId: "founders-brunch-circle",
      authorId: "system",
      text: "Usad este chat para contar que estais construyendo y reservar vuestra primera conversacion.",
      kind: "system",
      createdAt: "2026-06-15T12:00:00+02:00"
    },
    {
      id: "group-brunch-2",
      eventId: "founders-brunch-circle",
      authorId: "nora-costa",
      text: "Yo voy desde Lisboa y me interesa mucho conocer gente de producto y marca.",
      kind: "text",
      createdAt: "2026-06-15T12:22:00+02:00"
    },
    {
      id: "group-brunch-3",
      eventId: "founders-brunch-circle",
      authorId: "lucia-serrano",
      text: "Si alguien esta montando comunidad o experiencias, tengo mil ganas de hablar.",
      kind: "text",
      createdAt: "2026-06-15T12:24:00+02:00"
    }
  ],
  privateChatRequests: [
    {
      id: "request-mateo-lucia-after",
      eventId: "after-solar-2026",
      fromUserId: "mateo-rivas",
      toUserId: "lucia-serrano",
      message:
        "He visto que tambien te interesan comunidad y eventos. Si te apetece, abrimos chat y nos ubicamos antes de subir.",
      status: "pending",
      createdAt: "2026-06-15T19:15:00+02:00"
    },
    {
      id: "request-lucia-ines-after",
      eventId: "after-solar-2026",
      fromUserId: "lucia-serrano",
      toUserId: "ines-oliver",
      message:
        "Tu perfil me ha dado mucha curiosidad. Si te va, abrimos privado y vemos si coincidimos al llegar.",
      status: "accepted",
      createdAt: "2026-06-15T18:52:00+02:00",
      respondedAt: "2026-06-15T19:02:00+02:00"
    },
    {
      id: "request-lucia-diego-after",
      eventId: "after-solar-2026",
      fromUserId: "lucia-serrano",
      toUserId: "diego-luna",
      message:
        "Creo que podemos tener buena conversacion de hospitality y comunidad. Te apetece abrir chat?",
      status: "rejected",
      createdAt: "2026-06-15T19:08:00+02:00",
      respondedAt: "2026-06-15T19:30:00+02:00"
    }
  ],
  privateChats: [
    {
      id: "chat-lucia-ines",
      participantIds: ["lucia-serrano", "ines-oliver"],
      originEventId: "after-solar-2026",
      requestId: "request-lucia-ines-after",
      createdAt: "2026-06-15T19:02:00+02:00"
    }
  ],
  privateMessages: [
    {
      id: "private-lucia-ines-1",
      chatId: "chat-lucia-ines",
      authorId: "ines-oliver",
      text: "Aceptada. Me mola hablar antes para no llegar en frio.",
      createdAt: "2026-06-15T19:03:00+02:00"
    },
    {
      id: "private-lucia-ines-2",
      chatId: "chat-lucia-ines",
      authorId: "lucia-serrano",
      text: "Total. Yo seguramente llegue sobre las nueve y media.",
      createdAt: "2026-06-15T19:05:00+02:00"
    },
    {
      id: "private-lucia-ines-3",
      chatId: "chat-lucia-ines",
      authorId: "ines-oliver",
      text: "Perfecto. Te escribo por aqui cuando suba y asi nos ubicamos.",
      createdAt: "2026-06-15T19:08:00+02:00"
    }
  ],
  organizerLeads: [
    {
      id: "lead-sara",
      fromUserId: "sara-mora",
      companyName: "Mono Studio",
      concept: "Cenas creativas para gente de arte y moda",
      message:
        "No quiero montar eventos abiertos sin curacion. Me gustaria hablar con vosotros para activar un perfil organizador.",
      status: "pending",
      createdAt: "2026-06-15T17:40:00+02:00"
    }
  ]
};
