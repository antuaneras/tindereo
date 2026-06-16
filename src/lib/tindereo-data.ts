import type {
  EventCategory,
  EventInvite,
  Friendship,
  PersistedState,
  PlatformUser,
  SocialPost,
  StoryItem
} from "@/lib/tindereo-types";

export const APP_NAME = "Tindereo";
export const APP_TAGLINE = "Eventos que conectan antes de empezar";

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
    city: "Madrid",
    title: "Brand strategist",
    company: "North Studio",
    bio:
      "Me gustan los eventos con ritmo, gente curiosa y conversaciones que siguen despues del plan.",
    tagline: "Creo eventos pequenos, me apunto a los buenos y cuido mucho la comunidad.",
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
    city: "Valencia",
    title: "Founder",
    company: "Scene Ops",
    bio:
      "Soy de los que llega pronto, habla con todo el mundo y acaba proponiendo el siguiente plan antes de irse.",
    tagline: "Si hay energia buena, me apunto y tambien la organizo.",
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
  }
];

export const DEMO_FRIENDSHIPS: Friendship[] = [
  {
    id: "friendship-lucia-ines",
    userIds: ["lucia-serrano", "ines-oliver"],
    createdAt: "2026-06-01T10:00:00+02:00"
  },
  {
    id: "friendship-lucia-mateo",
    userIds: ["lucia-serrano", "mateo-rivas"],
    createdAt: "2026-06-03T10:00:00+02:00"
  },
  {
    id: "friendship-sara-nora",
    userIds: ["sara-mora", "nora-costa"],
    createdAt: "2026-06-05T12:00:00+02:00"
  },
  {
    id: "friendship-diego-mateo",
    userIds: ["diego-luna", "mateo-rivas"],
    createdAt: "2026-06-07T12:00:00+02:00"
  }
];

export const DEMO_EVENT_INVITES: EventInvite[] = [
  {
    id: "invite-lucia-ines-secret",
    eventId: "cena-secreta-estudio",
    fromUserId: "lucia-serrano",
    toUserId: "ines-oliver",
    status: "accepted",
    createdAt: "2026-06-13T12:45:00+02:00",
    respondedAt: "2026-06-13T13:10:00+02:00"
  },
  {
    id: "invite-diego-lucia-brunch",
    eventId: "founders-brunch-circle",
    fromUserId: "diego-luna",
    toUserId: "lucia-serrano",
    status: "accepted",
    createdAt: "2026-06-14T11:40:00+02:00",
    respondedAt: "2026-06-14T12:08:00+02:00"
  },
  {
    id: "invite-sara-lucia-design",
    eventId: "design-night-lab",
    fromUserId: "sara-mora",
    toUserId: "lucia-serrano",
    status: "pending",
    createdAt: "2026-06-16T17:25:00+02:00"
  }
];

export const DEMO_SOCIAL_POSTS: SocialPost[] = [
  {
    id: "post-event-after-1",
    authorType: "event",
    authorId: "after-solar-2026",
    imageUrl:
      "https://images.unsplash.com/photo-1501386761578-eac5c94b800a?auto=format&fit=crop&w=1200&q=80",
    caption: "Moodboard del rooftop. Vamos subiendo energia antes del sabado.",
    createdAt: "2026-06-16T16:20:00+02:00"
  },
  {
    id: "post-lucia-1",
    authorType: "user",
    authorId: "lucia-serrano",
    imageUrl:
      "https://images.unsplash.com/photo-1511578314322-379afb476865?auto=format&fit=crop&w=1200&q=80",
    caption: "Buscando planes con gente que venga a hablar de verdad y no solo a fichar.",
    createdAt: "2026-06-16T14:40:00+02:00"
  },
  {
    id: "post-ines-1",
    authorType: "user",
    authorId: "ines-oliver",
    imageUrl:
      "https://images.unsplash.com/photo-1529156069898-49953e39b3ac?auto=format&fit=crop&w=1200&q=80",
    caption: "Cuando un evento ya tiene conversacion buena antes de abrir puertas, se nota mucho.",
    createdAt: "2026-06-16T13:05:00+02:00"
  },
  {
    id: "post-event-secret-1",
    authorType: "event",
    authorId: "cena-secreta-estudio",
    imageUrl:
      "https://images.unsplash.com/photo-1414235077428-338989a2e8c0?auto=format&fit=crop&w=1200&q=80",
    caption: "Mesa larga, luz baja y conversaciones con tiempo. La cena secreta ya tiene ambiente.",
    createdAt: "2026-06-15T22:10:00+02:00"
  },
  {
    id: "post-mateo-1",
    authorType: "user",
    authorId: "mateo-rivas",
    imageUrl:
      "https://images.unsplash.com/photo-1515169067868-5387ec356754?auto=format&fit=crop&w=1200&q=80",
    caption: "Si un brunch no me deja dos conversaciones nuevas, no cuenta.",
    createdAt: "2026-06-15T11:18:00+02:00"
  }
];

export const DEMO_STORIES: StoryItem[] = [
  {
    id: "story-lucia-1",
    authorType: "user",
    authorId: "lucia-serrano",
    imageUrl:
      "https://images.unsplash.com/photo-1492684223066-81342ee5ff30?auto=format&fit=crop&w=800&q=80",
    caption: "Sunset scouting para el sábado",
    createdAt: "2026-06-16T18:10:00+02:00",
    expiresAt: "2026-06-17T18:10:00+02:00"
  },
  {
    id: "story-after-1",
    authorType: "event",
    authorId: "after-solar-2026",
    imageUrl:
      "https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?auto=format&fit=crop&w=800&q=80",
    caption: "Prueba de sonido y cielo limpio",
    createdAt: "2026-06-16T17:50:00+02:00",
    expiresAt: "2026-06-17T17:50:00+02:00"
  },
  {
    id: "story-ines-1",
    authorType: "user",
    authorId: "ines-oliver",
    imageUrl:
      "https://images.unsplash.com/photo-1517457373958-b7bdd4587205?auto=format&fit=crop&w=800&q=80",
    caption: "Referencias visuales para la semana",
    createdAt: "2026-06-16T12:20:00+02:00",
    expiresAt: "2026-06-17T12:20:00+02:00"
  },
  {
    id: "story-design-1",
    authorType: "event",
    authorId: "design-night-lab",
    imageUrl:
      "https://images.unsplash.com/photo-1517048676732-d65bc937f952?auto=format&fit=crop&w=800&q=80",
    caption: "Mood de la noche",
    createdAt: "2026-06-16T11:05:00+02:00",
    expiresAt: "2026-06-17T11:05:00+02:00"
  }
];

export const DEFAULT_STATE: PersistedState = {
  session: {
    isAuthenticated: false,
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
      visibility: "public",
      city: "Madrid",
      venue: "La Marina Rooftop",
      coverImage:
        "https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?auto=format&fit=crop&w=1600&q=80",
      startsAt: "2026-06-19T20:30:00+02:00",
      endsAt: "2026-06-20T02:30:00+02:00",
      createdAt: "2026-06-09T18:00:00+02:00",
      priceLabel: "Desde 18 EUR",
      capacity: 140,
      baseGuestCount: 2,
      hostId: "lucia-serrano",
      summary:
        "Rooftop al atardecer con DJ set y admision moderada para que la comunidad se forme antes de subir.",
      description:
        "Lucia ha abierto este evento como publico, pero mantiene aprobacion manual para cuidar el tono del grupo. En cuanto te aprueban, entras al chat general para presentarte y proponer mini planes antes de llegar.",
      highlights: [
        "Solicitud de acceso antes de entrar al evento",
        "Chat general solo para asistentes aprobados",
        "Privados entre personas que se aceptan"
      ],
      tags: ["Rooftop", "DJ set", "Comunidad", "Madrid", "Sunset"],
      dressCode: "Summer city",
      conversationPrompt:
        "Cuenta que te trae al evento y con que tipo de gente te gustaria cruzarte antes del set fuerte.",
      minimumGuestsRequired: 4,
      validationWindowDays: 7
    },
    {
      id: "founders-brunch-circle",
      slug: "founders-brunch-circle",
      title: "Founders Brunch Circle",
      category: "networking",
      visibility: "public",
      city: "Madrid",
      venue: "Casa Numa",
      coverImage:
        "https://images.unsplash.com/photo-1511578314322-379afb476865?auto=format&fit=crop&w=1600&q=80",
      startsAt: "2026-06-22T11:00:00+02:00",
      endsAt: "2026-06-22T14:30:00+02:00",
      createdAt: "2026-06-14T10:15:00+02:00",
      priceLabel: "Reserva 24 EUR",
      capacity: 60,
      baseGuestCount: 1,
      hostId: "diego-luna",
      summary:
        "Brunch curado para perfiles de producto, growth y operaciones con acceso via solicitud.",
      description:
        "El objetivo no es intercambiar tarjetas. Es llegar al brunch habiendo abierto ya un par de conversaciones utiles. Diego revisa quien entra para mantener las mesas equilibradas y el grupo manejable.",
      highlights: [
        "Moderacion de asistentes por parte del creador",
        "Grupo previo con prompts para romper el hielo",
        "Objetivo minimo de 4 asistentes confirmados en 7 dias"
      ],
      tags: ["Brunch", "Networking", "Producto", "Founders"],
      dressCode: "Smart casual",
      conversationPrompt:
        "Presentate con una frase sobre lo que estas construyendo y que tipo de gente te gustaria conocer.",
      minimumGuestsRequired: 4,
      validationWindowDays: 7
    },
    {
      id: "design-night-lab",
      slug: "design-night-lab",
      title: "Design Night Lab",
      category: "creative",
      visibility: "public",
      city: "Madrid",
      venue: "Taller Cero",
      coverImage:
        "https://images.unsplash.com/photo-1517048676732-d65bc937f952?auto=format&fit=crop&w=1600&q=80",
      startsAt: "2026-06-27T19:30:00+02:00",
      endsAt: "2026-06-27T23:30:00+02:00",
      createdAt: "2026-06-02T09:00:00+02:00",
      priceLabel: "Invitacion + 12 EUR",
      capacity: 40,
      baseGuestCount: 1,
      hostId: "sara-mora",
      summary:
        "Mesa redonda, visuales y after para gente de diseno, contenido y direccion creativa.",
      description:
        "Sara ha montado un plan muy cuidado, pero a una semana de vida aun no alcanza el minimo deseado. La app lo marca para que el creador vea rapido si necesita mover mas invitaciones o activar promo.",
      highlights: [
        "Estado de viabilidad visible para el creador",
        "Grupo previo para presentaciones creativas",
        "Chats privados persistentes despues del evento"
      ],
      tags: ["Design", "Creative", "Visual culture", "Afterwork"],
      dressCode: "Expressive casual",
      conversationPrompt:
        "Comparte la referencia visual o proyecto que mas te apetece comentar esa noche.",
      minimumGuestsRequired: 4,
      validationWindowDays: 7
    },
    {
      id: "cena-secreta-estudio",
      slug: "cena-secreta-estudio",
      title: "Cena Secreta de Estudio",
      category: "food",
      visibility: "private",
      city: "Madrid",
      venue: "Location privada en Chamberi",
      coverImage:
        "https://images.unsplash.com/photo-1414235077428-338989a2e8c0?auto=format&fit=crop&w=1600&q=80",
      startsAt: "2026-06-24T21:00:00+02:00",
      endsAt: "2026-06-25T00:30:00+02:00",
      createdAt: "2026-06-13T12:40:00+02:00",
      priceLabel: "65 EUR menu cerrado",
      capacity: 16,
      baseGuestCount: 0,
      hostId: "lucia-serrano",
      summary:
        "Cena pequena, privada y con aprobacion manual para mezclar perfiles de marca, arte y hospitality.",
      description:
        "Este evento no aparece al publico general. Solo lo ve quien lo crea y quien ya tenga acceso. Lucia revisa cada solicitud para mantener el formato intimo y el equilibrio de la mesa.",
      highlights: [
        "Evento privado con aprobacion del creador",
        "Chat general de mesa solo para confirmados",
        "Seguimiento claro del minimo de 4 plazas"
      ],
      tags: ["Dinner club", "Privado", "Comunidad", "Madrid"],
      dressCode: "Elevated casual",
      conversationPrompt:
        "Cuenta por que te gustaria sentarte en esta mesa y que tipo de conversacion te atrae.",
      minimumGuestsRequired: 4,
      validationWindowDays: 7
    }
  ],
  memberships: [
    {
      id: "membership-after-mateo",
      eventId: "after-solar-2026",
      userId: "mateo-rivas",
      status: "approved",
      requestedAt: "2026-06-10T11:00:00+02:00",
      respondedAt: "2026-06-10T12:10:00+02:00"
    },
    {
      id: "membership-after-nora",
      eventId: "after-solar-2026",
      userId: "nora-costa",
      status: "approved",
      requestedAt: "2026-06-10T12:00:00+02:00",
      respondedAt: "2026-06-10T13:20:00+02:00"
    },
    {
      id: "membership-after-sara",
      eventId: "after-solar-2026",
      userId: "sara-mora",
      status: "pending",
      requestedAt: "2026-06-15T18:42:00+02:00"
    },
    {
      id: "membership-after-diego",
      eventId: "after-solar-2026",
      userId: "diego-luna",
      status: "rejected",
      requestedAt: "2026-06-12T19:05:00+02:00",
      respondedAt: "2026-06-12T21:30:00+02:00"
    },
    {
      id: "membership-brunch-lucia",
      eventId: "founders-brunch-circle",
      userId: "lucia-serrano",
      status: "approved",
      requestedAt: "2026-06-14T12:08:00+02:00",
      respondedAt: "2026-06-14T12:40:00+02:00"
    },
    {
      id: "membership-brunch-mateo",
      eventId: "founders-brunch-circle",
      userId: "mateo-rivas",
      status: "approved",
      requestedAt: "2026-06-14T12:15:00+02:00",
      respondedAt: "2026-06-14T13:05:00+02:00"
    },
    {
      id: "membership-brunch-nora",
      eventId: "founders-brunch-circle",
      userId: "nora-costa",
      status: "pending",
      requestedAt: "2026-06-15T08:55:00+02:00"
    },
    {
      id: "membership-design-ines",
      eventId: "design-night-lab",
      userId: "ines-oliver",
      status: "approved",
      requestedAt: "2026-06-03T19:10:00+02:00",
      respondedAt: "2026-06-03T19:45:00+02:00"
    },
    {
      id: "membership-design-nora",
      eventId: "design-night-lab",
      userId: "nora-costa",
      status: "rejected",
      requestedAt: "2026-06-05T16:10:00+02:00",
      respondedAt: "2026-06-05T18:00:00+02:00"
    },
    {
      id: "membership-secret-ines",
      eventId: "cena-secreta-estudio",
      userId: "ines-oliver",
      status: "approved",
      requestedAt: "2026-06-13T14:00:00+02:00",
      respondedAt: "2026-06-13T15:10:00+02:00"
    },
    {
      id: "membership-secret-mateo",
      eventId: "cena-secreta-estudio",
      userId: "mateo-rivas",
      status: "pending",
      requestedAt: "2026-06-15T11:05:00+02:00"
    }
  ],
  groupMessages: [
    {
      id: "group-after-1",
      eventId: "after-solar-2026",
      authorId: "system",
      text: "Grupo abierto. Presentaos y contad con quien os gustaria cruzaros antes de llegar.",
      kind: "system",
      createdAt: "2026-06-10T12:12:00+02:00"
    },
    {
      id: "group-after-2",
      eventId: "after-solar-2026",
      authorId: "mateo-rivas",
      text: "Yo llegare pronto. Si alguien quiere empezar arriba y luego bajar a pista, me apunto.",
      kind: "text",
      createdAt: "2026-06-15T18:42:00+02:00"
    },
    {
      id: "group-after-3",
      eventId: "after-solar-2026",
      authorId: "lucia-serrano",
      text: "Me apetece que la gente llegue con ganas de hablar un rato antes del set fuerte.",
      kind: "text",
      createdAt: "2026-06-15T18:46:00+02:00"
    },
    {
      id: "group-brunch-1",
      eventId: "founders-brunch-circle",
      authorId: "system",
      text: "Usad el grupo para contar que estais construyendo y reservar la primera conversacion.",
      kind: "system",
      createdAt: "2026-06-14T12:40:00+02:00"
    },
    {
      id: "group-brunch-2",
      eventId: "founders-brunch-circle",
      authorId: "lucia-serrano",
      text: "Si alguien trabaja comunidad o experiencias, tengo mil ganas de cruzarme.",
      kind: "text",
      createdAt: "2026-06-15T12:24:00+02:00"
    },
    {
      id: "group-secret-1",
      eventId: "cena-secreta-estudio",
      authorId: "system",
      text: "Mesa privada abierta. Usad este chat para calentar la cena y compartir por que os apetece venir.",
      kind: "system",
      createdAt: "2026-06-13T15:12:00+02:00"
    },
    {
      id: "group-secret-2",
      eventId: "cena-secreta-estudio",
      authorId: "ines-oliver",
      text: "Yo llevo tiempo queriendo una mesa pequena donde la gente vaya de verdad a conversar.",
      kind: "text",
      createdAt: "2026-06-13T19:10:00+02:00"
    }
  ],
  privateChatRequests: [
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
  friendships: DEMO_FRIENDSHIPS,
  eventInvites: DEMO_EVENT_INVITES,
  socialPosts: DEMO_SOCIAL_POSTS,
  stories: DEMO_STORIES
};
