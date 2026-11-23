export type RandomSong = {
  id: string
  title: string
  artist: string
  videoId?: string
  reserveVideoId?: string
}

export type RandomGenre = {
  id: string
  name: string
  songs: RandomSong[]
}

export type RandomLibraryState = {
  genres: Record<string, {
    enabled: boolean
    songs: Record<string, boolean>
  }>
}

const song = (id: string, title: string, artist: string): RandomSong => ({ id, title, artist })

export const RANDOM_LIBRARY: RandomGenre[] = [
  { id: 'sertanejo', name: 'Sertanejo', songs: [
    song('sert-evidencias','Evidências','Chitãozinho & Xororó'),
    song('sert-ai-se-eu-te-pego','Ai Se Eu Te Pego','Michel Teló'),
    song('sert-balada','Balada','Gusttavo Lima'),
    song('sert-camaro-amarelo','Camaro Amarelo','Munhoz & Mariano'),
    song('sert-largado-as-tracas','Largado às Traças','Zé Neto & Cristiano'),
    song('sert-batom-de-cereja','Batom de Cereja','Israel & Rodolffo'),
    song('sert-aquele-1','Aquele 1%','Marcos & Belutti feat. Wesley Safadão'),
    song('sert-propaganda','Propaganda','Jorge & Mateus'),
    song('sert-pense-em-mim','Pense em Mim','Leandro & Leonardo'),
    song('sert-dormi-na-praca','Dormi na Praça','Bruno & Marrone'),
  ]},
  { id: 'pagode', name: 'Pagode', songs: [
    song('pag-cheia-de-manias','Cheia de Manias','Raça Negra'),
    song('pag-depois-do-prazer','Depois do Prazer','Só Pra Contrariar'),
    song('pag-deixa-acontecer','Deixa Acontecer','Grupo Revelação'),
    song('pag-ta-escrito','Tá Escrito','Grupo Revelação'),
    song('pag-pessoa-errada','Me Apaixonei Pela Pessoa Errada','Exaltasamba'),
    song('pag-telegrama','Telegrama','Exaltasamba'),
    song('pag-assim-voce-mata','Assim Você Mata o Papai','Sorriso Maroto'),
    song('pag-ousadia-alegria','Ousadia & Alegria','Thiaguinho'),
    song('pag-melhor-eu-ir','Melhor Eu Ir','Menos é Mais'),
    song('pag-lancinho','Lancinho','Turma do Pagode'),
  ]},
  { id: 'samba', name: 'Samba', songs: [
    song('sam-deixa-vida','Deixa a Vida Me Levar','Zeca Pagodinho'),
    song('sam-faixa-amarela','Faixa Amarela','Zeca Pagodinho'),
    song('sam-maneiras','Maneiras','Zeca Pagodinho'),
    song('sam-vou-festejar','Vou Festejar','Beth Carvalho'),
    song('sam-nao-deixe','Não Deixe o Samba Morrer','Alcione'),
    song('sam-trem-das-onze','Trem das Onze','Adoniran Barbosa'),
    song('sam-show-continuar','O Show Tem Que Continuar','Fundo de Quintal'),
    song('sam-meu-lugar','Meu Lugar','Arlindo Cruz'),
    song('sam-conselho','Conselho','Almir Guineto'),
    song('sam-coisinha-do-pai','Coisinha do Pai','Beth Carvalho'),
  ]},
  { id: 'rock-nacional', name: 'Rock nacional', songs: [
    song('rn-garota-nacional','Garota Nacional','Skank'),
    song('rn-bete-balanco','Bete Balanço','Barão Vermelho'),
    song('rn-pro-dia','Pro Dia Nascer Feliz','Barão Vermelho'),
    song('rn-sonifera','Sonífera Ilha','Titãs'),
    song('rn-meu-erro','Meu Erro','Os Paralamas do Sucesso'),
    song('rn-primeiros-erros','Primeiros Erros','Capital Inicial'),
    song('rn-a-sua-maneira','À Sua Maneira','Capital Inicial'),
    song('rn-pais-filhos','Pais e Filhos','Legião Urbana'),
    song('rn-toda-forma','Toda Forma de Amor','Lulu Santos'),
    song('rn-pelados','Pelados em Santos','Mamonas Assassinas'),
  ]},
  { id: 'rock-internacional', name: 'Rock internacional', songs: [
    song('ri-livin-prayer',"Livin' on a Prayer",'Bon Jovi'),
    song('ri-dont-stop',"Don't Stop Believin'",'Journey'),
    song('ri-i-love-rock',"I Love Rock 'n' Roll",'Joan Jett'),
    song('ri-summer-69',"Summer of '69",'Bryan Adams'),
    song('ri-sweet-child',"Sweet Child O' Mine",'Guns N’ Roses'),
    song('ri-another-one','Another One Bites the Dust','Queen'),
    song('ri-we-will-rock','We Will Rock You','Queen'),
    song('ri-you-give-love','You Give Love a Bad Name','Bon Jovi'),
    song('ri-should-i-stay','Should I Stay or Should I Go','The Clash'),
    song('ri-made-for-loving','I Was Made for Lovin’ You','Kiss'),
  ]},
  { id: 'forro', name: 'Forró', songs: [
    song('for-rindo-a-toa','Rindo à Toa','Falamansa'),
    song('for-xote-milagres','Xote dos Milagres','Falamansa'),
    song('for-voce-nao-vale','Você Não Vale Nada','Calcinha Preta'),
    song('for-toma-conta','Toma Conta de Mim','Limão com Mel'),
    song('for-meu-vaqueiro','Meu Vaqueiro, Meu Peão','Mastruz com Leite'),
    song('for-esperando-janela','Esperando na Janela','Gilberto Gil'),
    song('for-xote-meninas','Xote das Meninas','Luiz Gonzaga'),
    song('for-isso-aqui','Isso Aqui Tá Bom Demais','Dominguinhos'),
    song('for-camarote','Camarote','Wesley Safadão'),
    song('for-tentativas','Tentativas em Vão','Garota Safada'),
  ]},
  { id: 'mpb', name: 'MPB / Festa brasileira', songs: [
    song('mpb-anunciacao','Anunciação','Alceu Valença'),
    song('mpb-pais-tropical','País Tropical','Jorge Ben Jor'),
    song('mpb-descobridor','Descobridor dos Sete Mares','Tim Maia'),
    song('mpb-nao-quero-dinheiro','Não Quero Dinheiro','Tim Maia'),
    song('mpb-como-uma-onda','Como Uma Onda','Lulu Santos'),
    song('mpb-palco','Palco','Gilberto Gil'),
    song('mpb-a-novidade','A Novidade','Gilberto Gil / Paralamas'),
    song('mpb-sina','Sina','Djavan'),
    song('mpb-whisky','Whisky a Go Go','Roupa Nova'),
    song('mpb-tempos-modernos','Tempos Modernos','Lulu Santos'),
  ]},
  { id: 'internacional', name: 'Internacional / Pop', songs: [
    song('pop-i-want-it','I Want It That Way','Backstreet Boys'),
    song('pop-wannabe','Wannabe','Spice Girls'),
    song('pop-uptown','Uptown Funk','Mark Ronson feat. Bruno Mars'),
    song('pop-dancing-queen','Dancing Queen','ABBA'),
    song('pop-wanna-dance','I Wanna Dance with Somebody','Whitney Houston'),
    song('pop-shake-it-off','Shake It Off','Taylor Swift'),
    song('pop-happy','Happy','Pharrell Williams'),
    song('pop-hips-dont-lie',"Hips Don't Lie",'Shakira'),
    song('pop-livin-vida','Livin’ la Vida Loca','Ricky Martin'),
    song('pop-despacito','Despacito','Luis Fonsi'),
  ]},
  { id: 'gospel', name: 'Gospel', songs: [
    song('gos-raridade','Raridade','Anderson Freire'),
    song('gos-bondade','Bondade de Deus','Isaías Saad'),
    song('gos-ousado-amor','Ousado Amor','Isaías Saad'),
    song('gos-bencaos','Bênçãos Que Não Têm Fim','Isadora Pompeo'),
    song('gos-deserto','Deserto','Maria Marçal'),
    song('gos-acalma','Acalma Meu Coração','Anderson Freire'),
    song('gos-milagre','Faz um Milagre em Mim','Regis Danese'),
    song('gos-sabor-mel','Sabor de Mel','Damares'),
    song('gos-ressuscita','Ressuscita-me','Aline Barros'),
    song('gos-promessas','Deus de Promessas','Davi Sacer'),
  ]},
  { id: 'infantil', name: 'Infantil', songs: [
    song('inf-pintinho','Pintinho Amarelinho','Galinha Pintadinha'),
    song('inf-fazendinha','Fazendinha','Mundo Bita'),
    song('inf-estatua','Estátua','Xuxa'),
    song('inf-ilarie','Ilariê','Xuxa'),
    song('inf-lua-cristal','Lua de Cristal','Xuxa'),
    song('inf-superfantastico','Superfantástico','Balão Mágico'),
    song('inf-uni-duni','Uni Duni Tê','Trem da Alegria'),
    song('inf-he-man','He-Man','Trem da Alegria'),
    song('inf-baby-shark','Baby Shark','Pinkfong'),
    song('inf-livre-estou','Livre Estou','Frozen'),
  ]},
  { id: 'funk', name: 'Funk / Pop-funk', songs: [
    song('funk-rap-felicidade','Rap da Felicidade','Cidinho & Doca'),
    song('funk-glamurosa','Glamurosa','MC Marcinho'),
    song('funk-cerol','Cerol na Mão','Bonde do Tigrão'),
    song('funk-motinha','Dança da Motinha','Tchakabum'),
    song('funk-ta-tranquilo','Tá Tranquilo, Tá Favorável','MC Bin Laden'),
    song('funk-poderosas','Show das Poderosas','Anitta'),
    song('funk-envolver','Envolver','Anitta'),
    song('funk-dancarina','Dançarina','Pedro Sampaio'),
    song('funk-sentadao','Sentadão','Pedro Sampaio'),
    song('funk-ta-ok','Tá OK','Dennis & Kevin O Chris'),
  ]},
  { id: 'axe', name: 'Axé / Festa', songs: [
    song('axe-festa','Festa','Ivete Sangalo'),
    song('axe-poeira','Sorte Grande / Poeira','Ivete Sangalo'),
    song('axe-arere','Arerê','Ivete Sangalo'),
    song('axe-beleza-rara','Beleza Rara','Banda Eva'),
    song('axe-eva','Eva','Banda Eva'),
    song('axe-milla','Milla','Netinho'),
    song('axe-praieiro','Praieiro','Jammil'),
    song('axe-prefixo','Prefixo de Verão','Banda Mel'),
    song('axe-voa-voa','Voa Voa','Chiclete com Banana'),
    song('axe-dandalunda','Dandalunda','Margareth Menezes'),
  ]},
]

export function defaultRandomLibraryState(): RandomLibraryState {
  return {
    genres: Object.fromEntries(RANDOM_LIBRARY.map(genre => [
      genre.id,
      {
        enabled: true,
        songs: Object.fromEntries(genre.songs.map(item => [item.id, true])),
      },
    ])),
  }
}


export const RANDOM_LIBRARY_KEY = 'kp:random-library-v1'

export function normalizeRandomLibraryState(saved?: RandomLibraryState | null): RandomLibraryState {
  const base = defaultRandomLibraryState()
  if (!saved?.genres) return base
  for (const genre of RANDOM_LIBRARY) {
    const old = saved.genres[genre.id]
    if (!old) continue
    base.genres[genre.id].enabled = old.enabled !== false
    for (const item of genre.songs) {
      if (old.songs && item.id in old.songs) base.genres[genre.id].songs[item.id] = old.songs[item.id] !== false
    }
  }
  return base
}

export function activeRandomSongs(state: RandomLibraryState): Array<RandomSong & { genreId: string; genreName: string }> {
  const out: Array<RandomSong & { genreId: string; genreName: string }> = []
  for (const genre of RANDOM_LIBRARY) {
    const cfg = state.genres[genre.id]
    if (!cfg?.enabled) continue
    for (const item of genre.songs) {
      if (cfg.songs[item.id] !== false) out.push({ ...item, genreId: genre.id, genreName: genre.name })
    }
  }
  return out
}
