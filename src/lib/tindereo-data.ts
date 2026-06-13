import type {
  ActivityPoint,
  ChatMessage,
  EventInfo,
  EventZone,
  MatchItem,
  RegistrationDraft,
  SwipeRecord,
  UserProfile
} from "@/lib/tindereo-types";

export const EVENT_INFO: EventInfo = {
  name: "After Solar",
  subtitle: "Noches que conectan",
  eventCode: "AFTER-SOLAR-2026",
  location: "La Marina Rooftop, Madrid",
  dateLabel: "Sabado 14 de junio · 20:00 a 03:00",
  organizerEmail: "organizador@tindereo.local",
  organizerPassword: "tardeo2026",
  liveAttendees: 347
};

export const INTEREST_OPTIONS = [
  "Musica electronica",
  "Reggaeton",
  "Techno",
  "House",
  "Viajes",
  "Emprendimiento",
  "Deporte",
  "Gastronomia",
  "Inversion",
  "Tecnologia",
  "Arte",
  "Moda",
  "Networking",
  "Nuevas amistades",
  "Cultura",
  "Videojuegos"
];

export const GOAL_OPTIONS = [
  "Conocer gente nueva",
  "Hacer amigos",
  "Networking profesional",
  "Encontrar pareja",
  "Tomar algo con gente afin",
  "Lo que surja"
];

export const RELATIONSHIP_OPTIONS = [
  "Soltero/a",
  "Libre",
  "En pareja",
  "Prefiero no decir"
];

export const AVATAR_CHOICES = [
  {
    photo:
      "https://images.unsplash.com/photo-1553197661-8a95fd20858b?w=400&h=400&fit=crop&auto=format",
    coverPhoto:
      "https://images.unsplash.com/photo-1603190287605-e6ade32fa852?w=1200&h=600&fit=crop&auto=format"
  },
  {
    photo:
      "https://images.unsplash.com/photo-1760595968567-c5b981a8d6df?w=400&h=400&fit=crop&auto=format",
    coverPhoto:
      "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=1200&h=600&fit=crop&auto=format"
  },
  {
    photo:
      "https://images.unsplash.com/photo-1780587481270-dc7d287f40cc?w=400&h=400&fit=crop&auto=format",
    coverPhoto:
      "https://images.unsplash.com/photo-1506157786151-b8491531f063?w=1200&h=600&fit=crop&auto=format"
  }
];

export const DEFAULT_REGISTRATION: RegistrationDraft = {
  name: "",
  age: "26",
  instagram: "",
  city: "Madrid",
  occupation: "",
  relationship: "Soltero/a",
  bio: "",
  interests: ["Techno", "Viajes"],
  goal: "",
  photo: AVATAR_CHOICES[0].photo,
  coverPhoto: AVATAR_CHOICES[0].coverPhoto
};

export const EVENT_ZONES: EventZone[] = [
  { id: "barra", label: "Barra", emoji: "🍹", x: 15, y: 55, w: 22, h: 18, people: 47, color: "#FF5A5F" },
  { id: "terraza", label: "Terraza", emoji: "🌙", x: 58, y: 10, w: 35, h: 25, people: 83, color: "#FF8C42" },
  { id: "dj", label: "DJ Stage", emoji: "🎧", x: 35, y: 38, w: 28, h: 22, people: 124, color: "#FFB347" },
  { id: "chill", label: "Zona Chill", emoji: "🛋", x: 12, y: 25, w: 20, h: 24, people: 31, color: "#B8AFA4" },
  { id: "food", label: "Food Trucks", emoji: "🌮", x: 60, y: 65, w: 32, h: 22, people: 56, color: "#3D3630" }
];

export const DEMO_USER: UserProfile = {
  id: "sofia-demo",
  name: "Sofia M.",
  age: 26,
  city: "Madrid",
  occupation: "Disenadora UX",
  instagram: "@sofiadesigna",
  relationship: "Soltero/a",
  goal: "Lo que surja",
  bio: "Disenadora de experiencias. Aqui por la musica, la energia y las conversaciones sin pose.",
  interests: ["Techno", "Viajes", "Arte", "Emprendimiento", "Gastronomia"],
  photo: AVATAR_CHOICES[0].photo,
  coverPhoto: AVATAR_CHOICES[0].coverPhoto,
  zoneId: "dj",
  points: 620,
  matches: 2,
  superLikes: 1,
  gender: "Mujer",
  joinedAt: "2026-06-13T21:32:00.000Z",
  status: "online",
  headline: "Aqui por la pista y las charlas honestas."
};

export const BASE_ATTENDEES: UserProfile[] = [
  {
    id: "valentina",
    name: "Valentina",
    age: 26,
    city: "Madrid",
    occupation: "DJ y disenadora",
    instagram: "@valeafter",
    relationship: "Soltero/a",
    goal: "Conocer gente nueva",
    bio: "DJ los fines de semana, disenadora entre semana. Aqui por el techno y las buenas charlas.",
    interests: ["Techno", "Arte", "Viajes", "Moda"],
    photo: "https://images.unsplash.com/photo-1760595968567-c5b981a8d6df?w=500&h=700&fit=crop&auto=format",
    coverPhoto: "https://images.unsplash.com/photo-1506157786151-b8491531f063?w=1200&h=600&fit=crop&auto=format",
    zoneId: "terraza",
    points: 1840,
    matches: 12,
    superLikes: 4,
    gender: "Mujer",
    joinedAt: "2026-06-13T20:12:00.000Z",
    status: "chatting",
    headline: "Una mezcla de musica, terraceo y cero prisa."
  },
  {
    id: "carlos",
    name: "Carlos",
    age: 29,
    city: "Madrid",
    occupation: "Founder",
    instagram: "@carlosscale",
    relationship: "Libre",
    goal: "Networking profesional",
    bio: "Monto productos B2B entre semana y me escapo a bailar house cada vez que puedo.",
    interests: ["House", "Inversion", "Emprendimiento", "Tecnologia", "Networking"],
    photo: "https://images.unsplash.com/photo-1762066436642-945a40f35097?w=500&h=700&fit=crop&auto=format",
    coverPhoto: "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=1200&h=600&fit=crop&auto=format",
    zoneId: "barra",
    points: 1620,
    matches: 9,
    superLikes: 3,
    gender: "Hombre",
    joinedAt: "2026-06-13T20:26:00.000Z",
    status: "online",
    headline: "Buen vino, producto digital y pista cuando cae el drop."
  },
  {
    id: "camila",
    name: "Camila",
    age: 24,
    city: "Valencia",
    occupation: "Brand strategist",
    instagram: "@camistories",
    relationship: "Soltero/a",
    goal: "Tomar algo con gente afin",
    bio: "Emprendedora, curiosa y fan de la musica con groove. Si hay rooftop, mejor.",
    interests: ["House", "Emprendimiento", "Moda", "Viajes", "Gastronomia"],
    photo: "https://images.unsplash.com/photo-1780587481270-dc7d287f40cc?w=500&h=700&fit=crop&auto=format",
    coverPhoto: "https://images.unsplash.com/photo-1603190287605-e6ade32fa852?w=1200&h=600&fit=crop&auto=format",
    zoneId: "dj",
    points: 1440,
    matches: 8,
    superLikes: 3,
    gender: "Mujer",
    joinedAt: "2026-06-13T20:48:00.000Z",
    status: "online",
    headline: "Rooftops, house y conversaciones que luego siguen."
  },
  {
    id: "daniela",
    name: "Daniela",
    age: 28,
    city: "Sevilla",
    occupation: "Arquitecta",
    instagram: "@dani.plans",
    relationship: "Soltero/a",
    goal: "Conocer gente nueva",
    bio: "Arquitecta de dia, bailarina de noche. Viaje tres paises este ano y aun quiero mas.",
    interests: ["Viajes", "Arte", "Moda", "Cultura"],
    photo: "https://images.unsplash.com/photo-1553197661-8a95fd20858b?w=500&h=700&fit=crop&auto=format",
    coverPhoto: "https://images.unsplash.com/photo-1506157786151-b8491531f063?w=1200&h=600&fit=crop&auto=format",
    zoneId: "chill",
    points: 1310,
    matches: 7,
    superLikes: 2,
    gender: "Mujer",
    joinedAt: "2026-06-13T21:02:00.000Z",
    status: "roaming",
    headline: "Arquitectura, baile y ganas de improvisar planes."
  },
  {
    id: "miguel",
    name: "Miguel",
    age: 31,
    city: "Bilbao",
    occupation: "Growth advisor",
    instagram: "@miguelbuilds",
    relationship: "Libre",
    goal: "Networking profesional",
    bio: "Mezclo growth, cafe y eventos bien montados. Tambien estoy aqui para bajar el ritmo y conocer gente real.",
    interests: ["Networking", "Tecnologia", "Emprendimiento", "Gastronomia"],
    photo: "https://images.unsplash.com/photo-1736299299252-638ebe282979?w=500&h=700&fit=crop&auto=format",
    coverPhoto: "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=1200&h=600&fit=crop&auto=format",
    zoneId: "food",
    points: 1120,
    matches: 6,
    superLikes: 1,
    gender: "Hombre",
    joinedAt: "2026-06-13T20:40:00.000Z",
    status: "roaming",
    headline: "Growth, tacos de medianoche y cero small talk."
  },
  {
    id: "alba",
    name: "Alba",
    age: 25,
    city: "Barcelona",
    occupation: "Product designer",
    instagram: "@albamakes",
    relationship: "Soltero/a",
    goal: "Hacer amigos",
    bio: "Diseno producto, hago fotos analógicas y no perdono un buen set de house.",
    interests: ["Arte", "Tecnologia", "House", "Nuevas amistades"],
    photo: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=500&h=700&fit=crop&auto=format",
    coverPhoto: "https://images.unsplash.com/photo-1603190287605-e6ade32fa852?w=1200&h=600&fit=crop&auto=format",
    zoneId: "terraza",
    points: 980,
    matches: 5,
    superLikes: 2,
    gender: "Mujer",
    joinedAt: "2026-06-13T21:18:00.000Z",
    status: "online",
    headline: "Diseno, fotos y una playlist que nunca falla."
  },
  {
    id: "leo",
    name: "Leo",
    age: 27,
    city: "Malaga",
    occupation: "Data analyst",
    instagram: "@leoinsights",
    relationship: "Prefiero no decir",
    goal: "Lo que surja",
    bio: "Me flipa cruzar gente distinta en eventos asi. Si hay data, tambien hay juego.",
    interests: ["Tecnologia", "Inversion", "Techno", "Videojuegos"],
    photo: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=500&h=700&fit=crop&auto=format",
    coverPhoto: "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=1200&h=600&fit=crop&auto=format",
    zoneId: "barra",
    points: 940,
    matches: 4,
    superLikes: 1,
    gender: "Hombre",
    joinedAt: "2026-06-13T20:58:00.000Z",
    status: "roaming",
    headline: "Data, techno y planes que nacen sobre la marcha."
  },
  {
    id: "nora",
    name: "Nora",
    age: 30,
    city: "Madrid",
    occupation: "Fotografa",
    instagram: "@noraonfilm",
    relationship: "Soltero/a",
    goal: "Conocer gente nueva",
    bio: "Voy con mi camara a todas partes y casi siempre acabo en la terraza viendo a la gente bailar.",
    interests: ["Arte", "Moda", "Viajes", "Cultura"],
    photo: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=500&h=700&fit=crop&auto=format",
    coverPhoto: "https://images.unsplash.com/photo-1506157786151-b8491531f063?w=1200&h=600&fit=crop&auto=format",
    zoneId: "terraza",
    points: 890,
    matches: 4,
    superLikes: 1,
    gender: "Mujer",
    joinedAt: "2026-06-13T21:10:00.000Z",
    status: "online",
    headline: "Camara al hombro y ganas de conocer a quien suma."
  },
  {
    id: "sam",
    name: "Sam",
    age: 28,
    city: "Lisboa",
    occupation: "Creative coder",
    instagram: "@sampatches",
    relationship: "Libre",
    goal: "Tomar algo con gente afin",
    bio: "Creative coding, visuales y ritual de sunset con buena conversacion.",
    interests: ["Tecnologia", "Arte", "Musica electronica", "Networking"],
    photo: "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=500&h=700&fit=crop&auto=format",
    coverPhoto: "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=1200&h=600&fit=crop&auto=format",
    zoneId: "dj",
    points: 860,
    matches: 3,
    superLikes: 1,
    gender: "No binario",
    joinedAt: "2026-06-13T20:36:00.000Z",
    status: "chatting",
    headline: "Visuales, codigo y una copa bien elegida."
  }
];

export const DEMO_SWIPES: SwipeRecord[] = [
  {
    id: "swipe-demo-1",
    fromUserId: "sofia-demo",
    toUserId: "valentina",
    direction: "right",
    createdAt: "2026-06-13T22:14:00.000Z"
  },
  {
    id: "swipe-demo-2",
    fromUserId: "sofia-demo",
    toUserId: "carlos",
    direction: "super",
    createdAt: "2026-06-13T22:20:00.000Z"
  },
  {
    id: "swipe-demo-3",
    fromUserId: "sofia-demo",
    toUserId: "leo",
    direction: "left",
    createdAt: "2026-06-13T22:28:00.000Z"
  }
];

export const DEMO_MATCHES: MatchItem[] = [
  {
    id: "match-valentina",
    userIds: ["sofia-demo", "valentina"],
    createdAt: "2026-06-13T22:14:30.000Z",
    zoneId: "terraza",
    commonInterests: ["Techno", "Viajes", "Arte"],
    superLike: false,
    unreadCount: 2
  },
  {
    id: "match-carlos",
    userIds: ["sofia-demo", "carlos"],
    createdAt: "2026-06-13T22:20:20.000Z",
    zoneId: "barra",
    commonInterests: ["Emprendimiento"],
    superLike: true,
    unreadCount: 1
  }
];

export const DEMO_MESSAGES: Record<string, ChatMessage[]> = {
  "match-valentina": [
    {
      id: "msg-v-1",
      matchId: "match-valentina",
      senderId: "valentina",
      text: "Hola. Me alegra que hayamos hecho match.",
      createdAt: "2026-06-13T22:14:40.000Z",
      kind: "text"
    },
    {
      id: "msg-v-2",
      matchId: "match-valentina",
      senderId: "sofia-demo",
      text: "Igualmente. Vi que tambien te va el techno.",
      createdAt: "2026-06-13T22:15:20.000Z",
      kind: "text"
    },
    {
      id: "msg-v-3",
      matchId: "match-valentina",
      senderId: "valentina",
      text: "Estoy en la terraza ahora mismo. El DJ esta fino.",
      createdAt: "2026-06-13T22:16:20.000Z",
      kind: "text"
    },
    {
      id: "msg-v-4",
      matchId: "match-valentina",
      senderId: "valentina",
      text: "Que buena vibra hay arriba. Si subes me escribes.",
      createdAt: "2026-06-13T22:18:00.000Z",
      kind: "text"
    }
  ],
  "match-carlos": [
    {
      id: "msg-c-1",
      matchId: "match-carlos",
      senderId: "carlos",
      text: "Super like recibido. Eso merece brindis.",
      createdAt: "2026-06-13T22:21:00.000Z",
      kind: "text"
    },
    {
      id: "msg-c-2",
      matchId: "match-carlos",
      senderId: "carlos",
      text: "Estoy por la barra si te apetece saludar.",
      createdAt: "2026-06-13T22:23:00.000Z",
      kind: "text"
    }
  ]
};

export const ACTIVITY_CURVE: ActivityPoint[] = [
  { time: "20:00", users: 18, matches: 3 },
  { time: "21:00", users: 58, matches: 14 },
  { time: "22:00", users: 136, matches: 41 },
  { time: "23:00", users: 247, matches: 89 },
  { time: "00:00", users: 341, matches: 128 },
  { time: "01:00", users: 298, matches: 143 }
];

export const ADMIN_SNAPSHOT = {
  registeredUsers: 341,
  activeUsers: 298,
  matchesGenerated: 128,
  chatsStarted: 94
};

export const AUTO_REPLIES = [
  "Te leo. Si subes a la terraza avisa.",
  "Buena energia. Yo estoy cerca del DJ.",
  "Me gusta tu vibra. Luego nos cruzamos.",
  "Eso suena bien. Dame diez minutos y te digo."
];
