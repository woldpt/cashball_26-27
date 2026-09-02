// ── Commentary helpers — narração em português ─────────────────────────────

let lastPhrase = "";

// Sorteia uma frase sem repetir a última usada. As pools são literais criados
// em cada chamada, por isso filtrar a string em vez de indexar é suficiente.
function pickPhrase(phrases: string[]): string {
  if (phrases.length <= 1) return phrases[0];
  const pool = phrases.filter((p) => p !== lastPhrase);
  const pickFrom = pool.length > 0 ? pool : phrases;
  lastPhrase = pickFrom[Math.floor(Math.random() * pickFrom.length)];
  return lastPhrase;
}

// Contexto de golo — permite frases que reagem ao marcador e ao momento do
// jogo. O engine calcula os flags antes de incrementar o resultado.
interface GoalContext {
  opener?: boolean; // primeiro golo do jogo (0-0)
  equalizer?: boolean; // golo que empata
  comeback?: boolean; // golo que dá a volta ao resultado
  late?: boolean; // minuto ≥ 85
  winningBig?: boolean; // vantagem passa a ser de 3+ golos
}

function goalPhrase(name: string, ctx?: GoalContext): string {
  if (ctx?.comeback) return pickPhrase(comebackPhrases(name));
  if (ctx?.equalizer) return pickPhrase(equalizerPhrases(name));
  if (ctx?.opener) return pickPhrase(openerPhrases(name));
  if (ctx?.winningBig) return pickPhrase(winningBigPhrases(name));
  if (ctx?.late) return pickPhrase(lateGoalPhrases(name));
  return pickPhrase(defaultGoalPhrases(name));
}

// Auto-golo — um defensor da equipa contrária empurra a bola para a própria
// baliza. Conta como golo da equipa atacante no marcador, mas não credita
// nenhum jogador (sem update em players.goals).
function ownGoalPhrase(name: string): string {
  return pickPhrase([
    `AUTO-GOLOOO DE ${name.toUpperCase()}! A defesa tentou afastar e a bola acabou na própria baliza.`,
    `${name} tenta desviar e manda para a própria baliza. Que desastrão!`,
    `Auto-golo! ${name} não quis isto, mas as redes confirmam.`,
    `Auto-golo de ${name}! O defesa está com o rosto nas mãos.`,
    `${name} cruza... e entra na baliza da própria equipa. Sorte nenhuma, azar muito.`,
    `A bola quica em ${name} e vai para dentro. Auto-golo incontestável.`,
    `Que desvio trágico de ${name}! O guarda-redes nem se mexeu. Auto-golo.`,
    `${name} quis ser herói no despeje e saiu vilão. Auto-golo!`,
    `Auto-golo! ${name} olha para os céus como quem pede explicação.`,
    `Defesa perdida, bola a subir na direção errada... AUTO-GOLOOO DE ${name}!`,
    `${name} encosta sem querer e faz o auto-golo da equipa contrária.`,
    `Isto não pode estar a acontecer: auto-golo de ${name}, direto para a baliza.`,
  ]);
}

function defaultGoalPhrases(name: string): string[] {
  return [
    `GOLOOO! ${name} não perdoa!`,
    `${name} assina o golo. A baliza ficou sem palavras.`,
    `Ó ${name}! De onde veio isso?! É golooo!`,
    `${name} marca e faz das suas. Impossível de parar.`,
    `Golo!!! O guarda-redes ainda está a processar o que aconteceu.`,
    `${name} coloca a bola no fundo das redes. Que momento!`,
    `De cabeça! ${name} não deu hipótese. Pura classe.`,
    `Que golaço de ${name}! De fora da área e sem aviso. Silêncio total na bancada adversária.`,
    `${name} rouba a bola, arranca, remata — GOLO!!! Foi tudo tão rápido.`,
    `Golo de calcanhar!!! ${name} vai ser notícia amanhã de manhã.`,
    `Pé esquerdo, ângulo fechado, redes a abanar. ${name} é mesmo assim.`,
    `${name} recebe, controla, vira… e manda para o fundo. Simples quando se sabe.`,
    `GOOOLO! A bancada levantou-se toda de uma vez. ${name} festeja como se fosse o último.`,
    `Que assistência, que finalização. ${name} estava no sítio certo à hora certa.`,
    `Nem o guarda-redes acreditou. ${name} marcou de enfiada, no canto oposto.`,
    `GOLOOO! ${name} apareceu do nada e resolveu. Simples assim.`,
    `${name} encosta e está lá dentro. Futebol sem complicações.`,
    `Olha o toque de classe! ${name} pica por cima e faz magia.`,
    `Remate seco, direto, sem conversa. ${name} não quis saber.`,
    `${name} faz o golo e pergunta: "já acabou?"`,
    `GOLO!!! Defesa a dormir, ${name} acordado e atento.`,
    `${name} dança na área e depois... bola lá dentro. Espetáculo.`,
    `Que frieza! ${name} teve tempo para pensar, escolher e marcar.`,
    `${name} atira… e só se ouve a rede. Que som bonito.`,
    `GOLOOO! ${name} já estava a cheirar isto há minutos.`,
    `${name} faz parecer fácil. Spoiler: não é.`,
    `Confusão na área… sobra para ${name}… e já foste!`,
    `${name} com um toque subtil que vale ouro.`,
    `Que tiro! ${name} quase rasgava a baliza.`,
    `${name} não inventa: vê espaço, remata, festeja.`,
    `GOLO! ${name} aproveitou a oferta, obrigado e até já.`,
    `${name} aparece no sítio certo como quem marcou encontro com o golo.`,
    `Bola no pé de ${name} dentro da área? Já sabes o fim da história.`,
    `${name} não falha duas vezes. Nem uma, na verdade.`,
    `GOLOOO! ${name} resolveu isto em modo automático.`,
    `Que categoria! ${name} tratou a bola com carinho… e ela entrou.`,
    `${name} faz o golo e fica tudo a olhar uns para os outros.`,
    `Defesa abre espaço, ${name} diz “obrigado” e marca.`,
    `${name} puxa para dentro e… adeus, até amanhã.`,
    `GOLO! Nem deu tempo para reagir. ${name} foi relâmpago.`,
    `${name} vê a baliza, sorri… e já está lá dentro.`,
    `Que execução limpa! ${name} parecia estar sozinho no treino.`,
    `${name} com sangue frio. Gelado mesmo.`,
    `GOLOOO! Isto já estava escrito para ${name}.`,
    `${name} mete onde dói mais. Canto impossível.`,
    `${name} agarra a sobra e fuzila. Ninguém viu a bola a passar.`,
    `Golo estudado: cruzamento, desvio e ${name} a empurrar. Coleção.`,
    `${name} aparece na área como quem não quer a coisa… e quer muito.`,
    `Remate de primeira, sem domínio. ${name} tem pés de ouro.`,
    `A defesa pediu fora de jogo, o árbitro mandou seguir e ${name} agradeceu.`,
    `${name} faz do lance mais feio o golo mais bonito da tarde.`,
    `Tudo começou num pontapé comprido… e acabou nos pés de ${name}.`,
    `${name} engana toda a gente, inclusive o marcador. Golo à lá carte.`,
    `A rede ainda abana e a bancada ainda grita. ${name} é este espetáculo.`,
    `Depois deste golo, o jogo de ${name} merece aplausos no fim.`,
  ];
}

function openerPhrases(name: string): string[] {
  return [
    `GOLOOO! ${name} abre o marcador e o estádio vem abaixo!`,
    `Primeiro golo da noite: ${name} resolveu cedo e destravou o jogo.`,
    `${name} desbloqueia o resultado! 1-0 e o nó tático desfez-se.`,
    `Golo de abertura! ${name} quebra o gelo com um remate seco.`,
    `${name} inaugura o marcador. A partida muda de figura.`,
    `Primeiro a chegar, ${name} abre o jogo e coloca a equipa na frente.`,
    `GOLO! ${name} tira o nó ao jogo. Agora há festa à vista.`,
    `O jogo estava fechado até ${name} aparecer. 1-0 e tudo a mudar.`,
    `${name} assina o primeiro capítulo desta história. Vamos ver como termina.`,
    `Golo de abertura em pleno! ${name} pôs a equipa a sonhar desde cedo.`,
  ];
}

function equalizerPhrases(name: string): string[] {
  return [
    `EMPATA! ${name} restabelece a igualdade e devolve a vida à equipa.`,
    `Golo do empate! ${name} corrige o resultado e muda a cara do jogo.`,
    `${name} não se conformou: empata e manda um aviso ao adversário.`,
    `Empate no marcador graças a ${name}. O jogo recomeça do zero.`,
    `${name} assina a resposta na hora. Está tudo outra vez em aberto.`,
    `GOLO! ${name} puxa a equipa para cima e empata o jogo.`,
    `${name} devolve a esperança. O marcador volta a sorrir.`,
    `Que resposta de ${name}! Empata e a bancada acredita outra vez.`,
    `${name} empata com classe. O adversário tinha festejado cedo demais.`,
    `Golo da igualdade: ${name} mostra que o jogo só agora começa.`,
  ];
}

function comebackPhrases(name: string): string[] {
  return [
    `REVIRAVOLTA! ${name} vira o jogo e o estádio explode em euforia!`,
    `${name} completa a reviravolta! Quem perdia, agora manda.`,
    `Que história! ${name} dá a volta ao resultado e silencia quem já festejava.`,
    `GOLOOO! ${name} vira o marcador e escreve o nome na ata da tarde.`,
    `${name} vira o jogo do avesso. O banco levanta-se todo de uma vez.`,
    `Reviravolta no relvado! ${name} põe a equipa na frente e o adversário em choque.`,
    `${name} muda o guião: de perdedor a vencedor em três segundos.`,
    `Golo da viragem! ${name} transforma o desespero em festa.`,
    `${name} vira o resultado e o jogo já tem herói.`,
    `O adversário não vai acreditar: ${name} vira tudo e decide.`,
  ];
}

function lateGoalPhrases(name: string): string[] {
  return [
    `GOLO NO FINAL! ${name} marca no desespero e decide tudo!`,
    `Minuto 85+ e lá está ${name}! Golo que pode valer o jogo.`,
    `${name} aparece no tempo de compensação. Drama até ao último segundo.`,
    `Golo tardio de ${name}! A bancada vai sentir isto na garganta.`,
    `Quando tudo parecia decidido, ${name} muda o final da história.`,
    `GOLO! ${name} faz o estádio explodir já nos descontos.`,
    `Não há tempo, mas ${name} não precisou de muito. Golo no fim.`,
    `${name} guardou o melhor para o fim. O jogo tem novo desfecho.`,
    `Falta pouco e ${name} aproveita. Coração de muitos, cabeça de um só.`,
    `Golo na reta final de ${name}! O relógio já não espera mais ninguém.`,
  ];
}

function winningBigPhrases(name: string): string[] {
  return [
    `GOLEADA EM CURSO! ${name} amplia e o adversário está em ruínas.`,
    `${name} afunda mais um prego no caixão. O resultado já é pesado.`,
    `GOLO! ${name} soma e segue. O adversário só quer o apito final.`,
    `${name} amplia com autoridade. Isto já não é um jogo, é uma aula.`,
    `Mais um de ${name}. A diferença começa a ser humilhante.`,
    `${name} não tem piedade: mais um golo e a noite fica redonda.`,
    `Golo atrás de golo. ${name} está imparável e a bancada delira.`,
    `${name} amplia e o técnico adversário já só pensa no próximo jogo.`,
    `Que noite de ${name}! Mais um e o marcador fica comprometedor.`,
    `GOLOOO! ${name} transforma a partida numa demonstração de força.`,
  ];
}

function penaltyGoalPhrase(name: string): string {
  return pickPhrase([
    `Penálti convertido por ${name}. Frio como uma cerveja no ártico.`,
    `${name} bate e marca! O guarda-redes adivinhou o lado mas não chegou.`,
    `GOLO de penálti! ${name} não tremeu. Nervos de aço.`,
    `${name} — canto inferior, sem hipóteses. Impecável.`,
    `Da marca dos onze metros, ${name} não falha. Nunca.`,
    `Canto superior direito, velocidade de bala. ${name} é cruel.`,
    `O guarda-redes foi ao lado errado. ${name} sabia exactamente onde ia colocar.`,
    `Passada longa, balanço, remate seco. ${name} converteu como se fosse treino.`,
    `${name} encarou o guarda-redes, fez uma pausa… e atirou para o fundo. Teatro puro.`,
    `Penálti com categoria. ${name} enviou para o canto e não olhou para trás.`,
    `GOLO de penálti! ${name} foi lá com calma e saiu com festa.`,
    `${name} na marca… respira fundo… e manda lá para dentro.`,
    `Sem inventar, sem hesitar. ${name} faz o mais difícil parecer rotina.`,
    `${name} enganou o guarda-redes com o olhar. Depois foi só encostar.`,
    `Penálti batido com confiança. ${name} já ia a festejar antes de entrar.`,
    `${name} escolhe o canto, bate forte e não dá hipótese.`,
    `GOLO! ${name} tratou do assunto com classe e precisão.`,
    `${name} com aquela paradinha… e o guarda-redes ficou plantado.`,
    `Direto, simples, eficaz. ${name} não complicou.`,
    `${name} atira colocado e a rede agradece.`,
    `Penálti para ${name}… resultado? Já sabes.`,
    `${name} fez o guarda-redes cair primeiro. Depois só confirmou.`,
    `GOLOOO! ${name} não facilitou e resolveu rápido.`,
    `${name} olha, decide, executa. Manual perfeito.`,
    `Bateu com confiança total. ${name} nunca pareceu em dúvida.`,
    `${name} manda rasteiro, colado ao poste. Sem defesa possível.`,
    `O guarda-redes até tentou… mas ${name} foi mais esperto.`,
    `${name} com gelo nas veias. Nem piscou.`,
    `Penálti convertido sem drama. ${name} tratou disso.`,
    `${name} fez a baliza parecer enorme. E aproveitou.`,
    `${name} não vacila da marca dos onze metros.`,
    `GOLO! ${name} foi clínico. Bola para um lado, redes a abanar.`,
    `${name} disfarça… remata… e está feito.`,
    `${name} bate forte e colocado. Receita perfeita.`,
    `Penálti exemplar de ${name}. Sem hipótese de defesa.`,
    `${name} com um remate limpo que não perdoa.`,
    `GOLOOO! ${name} decidiu cedo e executou melhor ainda.`,
    `${name} transforma pressão em golo. Simples assim.`,
    `${name} não deu hipótese nem suspense. Foi direto ao ponto.`,
    `${name} fecha os olhos (quase) e marca com categoria.`,
    `${name} na marca dos onze metros parece um autómato. Cobrou, entrou.`,
    `Penálti por cima do guarda-redes? Não. No canto, como sempre. ${name}.`,
    `O guarda-redes caiu cedo. ${name} esperou, trocou o pé e marcou.`,
    `${name} deixa a bola assentar e a precisão faz o resto.`,
    `Penálti batido ao estilo antigo: força e certeza. ${name} não inventa.`,
  ]);
}

function penaltyMissPhrase(name: string, missType: string): string {
  const pools: Record<string, string[]> = {
    "DEFENDEU!": [
      `${name} rematou e o guarda-redes voltou a ser herói. Hoje não, amigo.`,
      `Defendeu! ${name} vai querer esquecer este momento depressa.`,
      `O guarda-redes adivinhou! ${name} fica com a cabeça nas mãos.`,
      `Inacreditável! O guarda-redes atirou-se para o canto certo e negou o golo a ${name}.`,
      `Que defesa! O guarda-redes leu o remate de ${name} e mandou para canto. Herói.`,
      `${name} rematou forte mas o guarda-redes estava lá. Hoje não era o dia.`,
      `Defendeu com a ponta dos dedos! ${name} não pode acreditar no que está a ver.`,
      `Dupla defesa! O guarda-redes negou o golo a ${name} e ainda travou a sobra.`,
      `${name} escolheu o canto… e o guarda-redes também. Azar dos grandes.`,
      `O guarda-redes fez o santo. ${name} rematou bem e ainda assim saiu derrotado.`,
    ],
    "AO POSTE!": [
      `Ó ferro! ${name} acertou no poste. O metal também tem sentimentos.`,
      `Ao poste! ${name} vai ouvir esse som nos sonhos esta noite.`,
      `O poste salva a equipa adversária. ${name} não acredita.`,
      `Toc! O ferro. ${name} atirou para o lado errado da trave. Por centímetros.`,
      `${name} mandou ao poste. A bola saiu. O desespero ficou.`,
      `Que azar de ${name}! A bola bateu na trave e saiu. O universo disse não.`,
      `Bateu no ferro e saiu. O estádio inteiro sentiu o baque de ${name}.`,
      `${name} acertou em cheio… na trave. Detalhe cruel.`,
      `O poste defendeu melhor que qualquer guarda-redes. ${name} a olhar para o céu.`,
      `Quase golo de ${name}! O ferro disse não e a sorte ficou do outro lado.`,
    ],
    "AO LADO!": [
      `Ao lado! ${name} mandou para os bancais. Os adeptos nem queriam ver.`,
      `Fora! ${name} deu uma aula de como não bater um penálti.`,
      `${name} rematou para a assistência. Literalmente.`,
      `A bola passou ao lado da baliza. ${name} vira as costas e não quer saber de nada.`,
      `Completamente ao lado! ${name} esqueceu-se de mirar. Acontece aos melhores… raramente.`,
      `${name} perdeu a noção do espaço. O remate foi mais para a rua do que para a baliza.`,
      `Para fora! ${name} nem acertou no alvo. Os adeptos taparam a cara.`,
      `O remate de ${name} foi ao encontro dos fotógrafos. Até aí, não entra.`,
      `${name} mandou a bola para o bairro vizinho. Lá pelo menos festejam.`,
      `Que remate de ${name}… pena que a baliza ficou de fora.`,
    ],
    "PANENKA FALHADO!": [
      `${name} tentou a Panenka… e falhou. A coragem foi, o golo não.`,
      `Panenka falhado! Haverá maneira mais espectacular de falhar? Provavelmente não.`,
      `${name} quis ser elegante. Ficou apenas por querer.`,
      `A Panenka de ${name} foi apanhada pelo guarda-redes. Isso vai doer durante semanas.`,
      `${name} tentou a bola ao centro com classe. O guarda-redes ficou e apanhou. Que cena.`,
      `Tentar uma Panenka com este resultado? ${name} é corajoso. E agora também está envergonhado.`,
      `Panenka falhada! O guarda-redes nem precisou de se mexer. ${name} queria ser bonito e saiu feio.`,
      `${name} arriscou a cavadinha… e o guarda-redes esperou com um sorriso.`,
      `A coragem de ${name} não chegou à rede. Panenka que fica na história — pela pior razão.`,
      `${name} ainda tentou disfarçar o erro com um aplauso. Ninguém aplaudiu.`,
    ],
  };
  return pickPhrase(pools[missType] || [`${name} falhou o penálti. Acontece.`]);
}

function varPhrase(name: string): string {
  return pickPhrase([
    `VAR consulta. Golo de ${name} anulado. A tecnologia: 1, alegria: 0.`,
    `Anulado! O VAR viu o que os outros não viram. Fora de jogo por meio nariz.`,
    `${name} festejou cedo demais. O VAR diz que não.`,
    `Golo anulado por VAR. Ninguém na bancada percebeu porquê, mas aceitaram.`,
    `O árbitro de vídeo interveio. ${name} desce do céu ao relvado.`,
    `VAR! O golo de ${name} foi ao microscópio e não sobreviveu. Meio dedão em fora de jogo.`,
    `Reviravolta tecnológica: o VAR anulou o golo. ${name} ainda está à espera de perceber.`,
    `A sala do VAR falou. O golo de ${name} foi cancelado. A multidão vaiu a modernidade.`,
    `${name} marcou, festejou, tirou a camisola e vai ser multado… por nada. Golo anulado.`,
    `Fora de jogo milimétrico. O VAR traçou linhas durante dois minutos e ${name} ficou sem golo.`,
    `VAR em ação! O golo de ${name} desapareceu mais rápido que apareceu.`,
    `Anulado pelo VAR! ${name} já festejava… agora só resta encolher os ombros.`,
    `${name} ainda apontava para o céu… mas o VAR trouxe-o de volta à terra.`,
    `Golo? Afinal não. O VAR cortou a festa a ${name}.`,
    `Silêncio no estádio… e depois vaias. O VAR anulou o golo de ${name}.`,
    `${name} correu meio campo a festejar. O VAR correu com o golo.`,
    `Revisão completa: o VAR não validou. ${name} fica a ver navios.`,
    `O árbitro desenha o retângulo… más notícias para ${name}.`,
    `${name} celebrou com estilo… pena que o VAR não achou piada.`,
    `Anulado! O detalhe mais pequeno tirou o golo a ${name}.`,
    `VAR decide: nada feito. ${name} já estava na fotografia… mas foi apagado.`,
    `${name} tinha tudo certo… menos uns centímetros.`,
    `O golo de ${name} foi vítima da tecnologia moderna.`,
    `Festejos interrompidos. ${name} não vai contar este.`,
    `O VAR tirou mais um da lista. ${name} não escapa.`,
    `${name} viu a rede abanar… mas o VAR viu outra coisa.`,
    `Anulado por detalhe mínimo. ${name} nem queria acreditar.`,
    `O estádio explode… e depois implode. VAR anulou o de ${name}.`,
    `${name} marcou… ou talvez não. O VAR diz que não conta.`,
    `Demorou, analisou, decidiu: sem golo para ${name}.`,
    `${name} já tinha combinado o festejo. O VAR cancelou os planos.`,
    `Golo apagado com borracha digital. ${name} que o diga.`,
    `${name} passou de herói a “quase” em segundos.`,
    `VAR implacável! ${name} fica sem o momento de glória.`,
    `Tudo milimétrico… e tudo anulado. ${name} sofre.`,
    `O ecrã confirma: festa cancelada para ${name}.`,
    `${name} ainda pergunta “porquê?”… o VAR responde com linhas.`,
    `Golo revertido! ${name} volta ao ponto de partida.`,
    `A tecnologia não perdoa. ${name} fica a zeros.`,
    `${name} até marcou bem… mas não marcou válido.`,
    `Fora de jogo por uma meia-lua. O VAR esticou a régua e ${name} encolheu.`,
    `Golo riscado! O VAR chamou o árbitro ao ecrã e ${name} ficou a ver.`,
    `${name} marcou, mas a linha do VAR não perdoa. Futebol do século.`,
    `O VAR demorou, pesou, mediu… e tirou o golo a ${name}.`,
    `${name} já estava a festejar com a família na bancada. O VAR cortou o beijo.`,
    `Revisão longa, veredicto cruel. ${name} sem golo e com o VAR a dormir descansado.`,
    `O golo de ${name} foi devolvido ao remetente: a tecnologia.`,
    `O VAR marcou a posição, o árbitro aceitou e ${name} fica com o esboço do golo.`,
  ]);
}

function yellowPhrase(name: string): string {
  return pickPhrase([
    `Amarelo para ${name}. Atenção, que o próximo pode ser perigoso.`,
    `${name} vê cartão amarelo. O árbitro avisa: calm down.`,
    `Falta de ${name} resulta em amarelo. A agressividade tem custos.`,
    `${name} vai para o caderno do árbitro. Talvez a mãe não ficasse orgulhosa.`,
    `Amarelo! ${name} precisa de gerir melhor os nervos no resto do jogo.`,
    `${name} protestar deu resultado: saiu um amarelo, não a decisão. Lição aprendida?`,
    `Falta desnecessária de ${name}. O árbitro não hesitou. Cartão no bolso, régua na mão.`,
    `${name} recebeu o amarelo com cara de espanto, como se fosse a primeira vez. Não é.`,
    `Toque de mais em ${name}. O árbitro assinalou falta e exibiu o cartão amarelo. Óbvio.`,
    `${name} jogou duro demais. O árbitro aproximou-se e produziu o cartão da camisa.`,
    `Simulação ou falta real? O árbitro não teve dúvidas. Amarelo para ${name}.`,
    `Cartão amarelo para ${name}. O árbitro não quis conversa.`,
    `${name} entra na lista dos avisados. Próxima pode doer.`,
    `Amarelo mostrado! ${name} tem de baixar a intensidade.`,
    `${name} exagerou no contacto… e levou a lembrança.`,
    `O árbitro puxa do amarelo. ${name} já sabe que está na corda bamba.`,
    `${name} tenta justificar… mas o cartão já está no ar.`,
    `Entrada dura de ${name}. Resultado: amarelo sem discussão.`,
    `${name} recebe o amarelo e fica a pensar no que fez.`,
    `Falta clara, decisão rápida. ${name} vê amarelo.`,
    `${name} não mede forças e paga o preço.`,
    `Amarelo para ${name}. O árbitro marca território.`,
    `${name} já tinha avisos… agora tem cartão.`,
    `O árbitro não gostou. ${name} também não.`,
    `${name} travou o adversário… e levou travão do árbitro.`,
    `Amarelo justo. ${name} foi com tudo e passou do ponto.`,
    `${name} fica marcado no jogo… literalmente.`,
    `O juiz saca do bolso e ${name} não escapa.`,
    `${name} joga no limite… e desta vez passou.`,
    `Amarelo para ${name}. Fica o aviso bem claro.`,
    `${name} tentou ser mais esperto… saiu-lhe o contrário.`,
    `Falta tática de ${name}. Cartão inevitável.`,
    `${name} protesta… mas só soma mais frustração.`,
    `Amarelo mostrado com convicção. ${name} que se controle.`,
    `${name} já sabe: mais uma destas e complica.`,
    `O árbitro viu tudo. ${name} não convenceu ninguém.`,
    `${name} comete a falta e recebe o “presente”.`,
    `Amarelo! ${name} fica sob vigilância apertada.`,
    `${name} não concorda… mas aceita (mais ou menos).`,
    `Entrada fora de tempo. ${name} leva amarelo sem surpresa.`,
    `${name} mete o pé onde não devia… e paga por isso.`,
    `${name} segura o adversário pela camisola. O árbitro viu tudo. Amarelo.`,
    `Mais um amarelo para ${name}. O jogo começa a ter um favorito: o árbitro.`,
    `${name} puxa o atacante para o relvado com estilo… de falta. Amarelo merecido.`,
    `O árbitro levou a mão ao bolso e ${name} ainda tentou negociar. Não deu.`,
    `Amarelo por demora a repor. ${name} já está a fazer de contas: quantos minutos sobraram?`,
    `${name} esqueceu que o árbitro é o patrão. Veio o cartão, logo a seguir.`,
    `Quarta falta da noite de ${name}. O árbitro marca o território.`,
    `Falta no meio-campo, cartão no bolso. ${name} está avisado: cuidado.`,
  ]);
}

function redPhrase(name: string): string {
  return pickPhrase([
    `Vermelho! ${name} vai para o balneário mais cedo. Muito mais cedo.`,
    `${name} expulso! A equipa passa a jogar com dez. Matemática cruel.`,
    `Red card! ${name} não vai assistir ao resto. Talvez seja melhor assim.`,
    `${name} despede-se do relvado hoje. O árbitro não estava para brincadeiras.`,
    `Expulso! ${name} fez a mala mental e foi para os balneários.`,
    `Falta brutal de ${name}. Vermelho directo, sem hesitação. O banco vai ferver.`,
    `${name} perde a cabeça e o árbitro não perdoa. Dez jogadores em campo.`,
    `Segundo amarelo para ${name}. A experiência devia ter ensinado mais. Expulso.`,
    `${name} vai para o balneário e os colegas ficam a olhar uns para os outros. Que momento.`,
    `O treinador adversário já estava a protestar. O árbitro fez justiça. Vermelho, ${name}.`,
    `${name} saiu de campo com uma cara que diz tudo. Expulso, e com razão.`,
    `Tão desnecessário quanto espectacular: vermelho para ${name}. O banco vai estar quente.`,
    `Vermelho direto! ${name} nem teve tempo para argumentar.`,
    `${name} expulso! Caminho livre para o balneário e cabeça a mil.`,
    `Rua! ${name} ultrapassou o limite e paga caro.`,
    `${name} vê vermelho e o jogo muda completamente.`,
    `Expulsão! ${name} deixa a equipa em apuros.`,
    `${name} exagerou… e o árbitro acabou com a conversa.`,
    `Vermelho sem rodeios. ${name} sai mais cedo, ponto final.`,
    `${name} já ia quente… agora vai para o duche.`,
    `Decisão dura, mas clara. ${name} está fora do jogo.`,
    `${name} comete o erro e vê o vermelho a caminho.`,
    `Expulso! ${name} nem olhou para trás.`,
    `${name} perde o duelo… e depois perde o lugar em campo.`,
    `Vermelho mostrado! ${name} não volta hoje.`,
    `${name} tentou esticar demais… rompeu o limite.`,
    `O árbitro não hesita. ${name} vai para a rua.`,
    `${name} deixa a equipa reduzida. Complicado agora.`,
    `Fim de linha para ${name} neste jogo.`,
    `${name} sai de cabeça baixa. Vermelho pesado.`,
    `Tudo aconteceu rápido… e ${name} já está fora.`,
    `Expulsão inevitável. ${name} sabia o risco.`,
    `${name} com entrada perigosa… e castigo máximo.`,
    `O banco levanta-se, mas a decisão está tomada. Vermelho para ${name}.`,
    `${name} nem acredita… mas vai mesmo sair.`,
    `Jogo acabou cedo para ${name}. Demasiado cedo.`,
    `${name} arriscou tudo… e perdeu.`,
    `Vermelho no ar! ${name} nem protesta muito.`,
    `${name} deixa o campo sob protestos… mas não há volta.`,
    `Expulso com estilo? Talvez. Mas continua a ser expulsão.`,
    `${name} compromete a equipa e paga com saída imediata.`,
    `Sem apelo nem agravo. ${name} vai para o balneário.`,
    `Vermelho! O árbitro nem pensou duas vezes. ${name} vai direto ao duche.`,
    `${name} saiu mais cedo e o banco fica de mãos na cabeça.`,
    `Cartão vermelho para ${name}. O jogo perde uma peça, o adversário ganha tudo.`,
    `O VAR confirmou e o árbitro não hesitou. ${name} está fora.`,
    `${name} deixa o relvado a abanar a cabeça. O VAR já não o salva.`,
    `Vermelho directo! ${name} nem chegou a fechar o zíper da mala.`,
    `A equipa de ${name} fica com dez. Matemática simples, dor complicada.`,
    `${name} foi expulso e o treinador adversário já está a planear o ataque.`,
    `Segundo amarelo, segundo passe para o balneário. ${name} não aprendeu.`,
    `Vermelho com exibição de dedos ao árbitro? ${name} vai pagar caro depois.`,
    `O estádio ferve, mas a decisão é fria: ${name} fora.`,
    `${name} viu vermelho e o vestiário vai ter conversa comprida.`,
  ]);
}

function injuryPhrase(name: string, severity: string): string {
  if (severity === "grave") {
    return pickPhrase([
      `${name} saiu de maca. As notícias não são boas, aparentemente.`,
      `Lesão grave para ${name}. O clube vai precisar de paciência (e suplentes).`,
      `${name} vai aos cuidados da equipa médica. Semanas fora, infelizmente.`,
      `${name} cai. O médico entra em campo com cara séria. Mau sinal.`,
      `${name} saiu a apoiar-se no médico. O estádio ficou em silêncio. Meses fora, talvez.`,
      `Lesão no joelho de ${name}? O médico chamou a maca. Ninguém sorri.`,
      `${name} ficou estendido. Demorou tempo. A maca entrou. Má notícia para o plantel.`,
      `${name} agarrou o tornozelo e não se levantou. Equipa médica a correr. Semanas fora.`,
      `${name} saiu de maca. O jogo seguiu… mas o silêncio ficou.`,
      `Lesão para ${name}. O estádio percebeu logo que não era nada simples.`,
      `${name} no chão… e o médico a abanar a cabeça. Péssimo sinal.`,
      `${name} abandona o relvado com assistência médica. Não vai ser rápido.`,
      `A cara de ${name} dizia tudo. A maca confirmou o resto.`,
      `${name} lesionado. O jogo perde um protagonista e ganha preocupação.`,
      `Maca em campo para ${name}. Já ninguém está a pensar no resultado.`,
      `${name} fica parado no relvado… e o tempo também parece parar.`,
      `Lesão séria para ${name}. O banco já começa a fazer contas.`,
      `${name} sai apoiado pela equipa médica. O silêncio fala mais alto.`,
      `O lance termina mal para ${name}. Muito mal mesmo.`,
      `${name} cai e não volta a levantar-se sozinho. Alarmes ligados.`,
      `Entrada dura, reação imediata. ${name} está fora de combate.`,
      `${name} sai de maca sob aplausos nervosos da bancada.`,
      `Lesão preocupante para ${name}. O treinador já olha para o banco.`,
      `${name} no chão há demasiado tempo. A maca não tardou.`,
      `Más notícias para ${name}. Isto não parece curto.`,
      `${name} deixa o campo e deixa também muitas dúvidas.`,
      `O jogo continua, mas ${name} já não. Lesão confirmada.`,
      `${name} sai com dores visíveis. O resto é espera e exames.`,
      `Silêncio no estádio. ${name} saiu de maca.`,
      `${name} tenta levantar… mas não dá. Assistência imediata.`,
      `Lesão no pior momento possível para ${name}.`,
      `${name} fora do jogo e provavelmente fora dos próximos também.`,
      `A equipa médica entra rápido. ${name} não vai voltar hoje.`,
      `${name} abandona o relvado com expressão fechada.`,
      `Tudo indica problema sério para ${name}.`,
      `${name} sai lentamente… e isso nunca é bom sinal.`,
      `Maca chamada para ${name}. O jogo perde ritmo e esperança.`,
      `${name} deixa o campo sob preocupação geral.`,
      `O joelho de ${name} cedeu e o plantel perde uma peça importante.`,
      `A torção pareceu feia logo à primeira vista. ${name} vai de maca.`,
      `${name} agarra o músculo e acena para o banco. O médico não sorri.`,
      `Mais um ligamento em dúvida. ${name} abandona e a época fica em risco.`,
      `${name} caiu num buraco do relvado. Ironia: o relvado nem é mau.`,
      `A equipa médica pede oxigénio. ${name} está inconsolável e o estádio em silêncio.`,
      `Lesão à vista de todos: ${name} tenta apoiar o peso e não consegue.`,
      `O capitão de ${name} já foi ao banco perguntar pelo hospital mais próximo.`,
      `Ninguém festejou o lance. A queda de ${name} parou o jogo e o coração.`,
      `${name} sai com a mão no rosto. Os adeptos pedem respostas que ninguém tem.`,
      `Isto cheira a lesão longa. ${name} e o clube vão precisar de paciência.`,
    ]);
  }
  return pickPhrase([
    `${name} sentiu uma pancada. Nada de grave, mas saiu por precaução.`,
    `${name} leva um golpe do destino e precisa de ser substituído.`,
    `Lesão ligeira para ${name}. Vai a exames, mas parece que não é nada de sério.`,
    `${name} pede substituição. O corpo disse basta por hoje.`,
    `${name} ficou a coxear depois do choque. O treinador não arriscou e pediu substituição.`,
    `Cãibra? Distensão? Não se sabe ainda. ${name} saiu por precaução, com cara de frustração.`,
    `${name} caiu, levantou-se, voltou a cair. O médico acenou para o banco. Substituição.`,
    `Bateu com força no chão. ${name} pediu para sair. Leve, mas não joga mais hoje.`,
    `${name} sentiu um toque mais duro. Sai por precaução, sem grandes dramas.`,
    `${name} pede substituição. Nada parece grave, mas o jogo acabou para ele.`,
    `Pequena queixa para ${name}. O banco não quis correr riscos.`,
    `${name} sai a coxear ligeiramente. Melhor não forçar.`,
    `Substituição pedida por ${name}. O corpo avisou a tempo.`,
    `${name} leva um choque no lance e fica limitado. Sai do jogo.`,
    `Não parece grave, mas ${name} não continua. Precaução acima de tudo.`,
    `${name} tenta ficar… mas rapidamente percebe que não dá.`,
    `Substituição inteligente. ${name} não arrisca agravar.`,
    `${name} sente desconforto e vai direto ao banco.`,
    `Pequeno susto para ${name}. Sai apenas por segurança.`,
    `${name} ainda tentou… mas acabou substituído.`,
    `O jogo fica mais curto para ${name}. Sai precocemente.`,
    `${name} não está a 100% e abandona o relvado.`,
    `Decisão rápida da equipa técnica: ${name} fora por precaução.`,
    `${name} abana a cabeça e pede mesmo para sair.`,
    `Leve incómodo para ${name}. Nada que pareça grave.`,
    `${name} sai com cuidado. Melhor não arriscar hoje.`,
    `O choque foi suficiente. ${name} vai para o banco.`,
    `${name} tenta continuar, mas o corpo não colabora.`,
    `Substituição preventiva para ${name}. Gestão de esforço.`,
    `${name} sai sem pressa, mas sem condições para continuar.`,
    `Frustração visível em ${name}. Sai mais cedo do que queria.`,
    `${name} deixa o campo com assistência leve.`,
    `Pequeno problema físico para ${name}. Substituído sem alarme.`,
    `${name} não aguenta o ritmo e é retirado do jogo.`,
    `Sai por precaução médica. ${name} deve recuperar rápido.`,
    `${name} tenta voltar… mas é imediatamente substituído.`,
    `Nada alarmante, mas ${name} não continua em campo.`,
    `${name} esticou o músculo e o banco reagiu logo. Precaução primeiro.`,
    `Um toque, um trejeito e ${name} pede saída. Melhor tratar já do que sofrer depois.`,
    `${name} sente a perna pesada e decide poupar-se. Há jogos para ganhar à frente.`,
    `O fisioterapeuta olhou, apalpou e disse não. ${name} sai sem drama.`,
    `${name} fez sinal ao banco: não é grave, mas não vale a pena arriscar.`,
    `Contusão simples para ${name}. O treinador prefere perder agora do que perder mais tarde.`,
    `${name} sai para exames rápidos. A equipa técnica já tem o plano B em pé.`,
    `Susto, não susto grande. ${name} deixa o campo a coxear, mas com a cabeça erguida.`,
    `O corpo de ${name} pediu para sair e o treinador ouviu. Gestão inteligente.`,
    `${name} troca o relvado pelo banco após uma pancada. Devia estar bom amanhã.`,
    `Falta o jogo, não a época. ${name} sai por segurança e tudo fica em aberto.`,
    `O banco chama ${name} para não o chamar mais tarde. Precaução de quem sabe.`,
    `Nada de estruturas comprometidas, mas ${name} já não rende. Sai.`,
  ]);
}

function subPhrase(outName: string, inName: string): string {
  return pickPhrase([
    `Substituição: ${outName} cede o lugar a ${inName}. Rotatividade ao poder.`,
    `${outName} sai, ${inName} entra. Alguém precisa de descanso.`,
    `Troca táctica: ${inName} vai mostrar o que vale. Sem pressão, claro.`,
    `${outName} dá lugar a ${inName}. O banco estava gelado, agora vai aquecer.`,
    `${inName} entra em campo. ${outName} agradece e desaparece do relvado.`,
    `O treinador apostou em ${inName}. ${outName} sai com aplausos — merecia mais minutos.`,
    `Mudança táctica: ${outName} foi sacrificado. ${inName} entra com fome de bola.`,
    `${outName} saiu exausto. ${inName} entra fresco. Energia nova para os minutos finais.`,
    `Substituição forçada: ${outName} não conseguia mais. ${inName} aceita o desafio.`,
    `${inName} aqueceu durante vinte minutos. Chegou a sua hora. ${outName} agradece e sai.`,
    `Substituição: ${outName} sai para dar lugar a ${inName}. O jogo continua sem pausas.`,
    `${outName} fora, ${inName} dentro. Renovação em andamento.`,
    `Mudança no onze: ${inName} entra e ${outName} vai descansar.`,
    `${outName} sai sob aplausos moderados. ${inName} assume a função.`,
    `Troca feita: ${inName} entra com energia nova, ${outName} sai tranquilo.`,
    `${outName} cede o lugar a ${inName}. O banco já respirava aliviado.`,
    `${inName} entra em campo. ${outName} já está a caminho do banco.`,
    `Substituição simples: ${outName} sai, ${inName} entra. Sem drama.`,
    `${inName} vai a jogo. ${outName} sai com o trabalho feito.`,
    `Rotação em campo: ${outName} fora, ${inName} dentro.`,
    `${outName} abandona o relvado. ${inName} entra com vontade.`,
    `Mudança fresca: ${inName} substitui ${outName}. Novas pernas em campo.`,
    `${outName} sai e o público regista. ${inName} entra em ação.`,
    `Substituição tática: ${inName} entra para mexer com o jogo.`,
    `${outName} sai mais cedo do que queria. ${inName} assume.`,
    `Entrada de ${inName}. Saída de ${outName}. Simples e direto.`,
    `${inName} entra para acrescentar intensidade. ${outName} já cumpriu.`,
    `Substituição feita sem demora: ${outName} por ${inName}.`,
    `${inName} aqueceu e agora entra. ${outName} sai com esforço.`,
    `Troca estratégica: ${inName} em campo, ${outName} fora.`,
    `${outName} sai e deixa o palco para ${inName}.`,
    `${inName} entra para refrescar o meio-campo. ${outName} descansa.`,
    `Substituição confirmada: ${outName} deixa o jogo, ${inName} entra.`,
    `${inName} recebe instruções rápidas e entra. ${outName} sai.`,
    `Mudança direta: ${outName} por ${inName}. Sem hesitações.`,
    `${inName} entra com missão clara. ${outName} já terminou o turno.`,
    `${outName} deixa o relvado. ${inName} vem dar continuidade.`,
    `Substituição clássica: ${inName} substitui ${outName}.`,
    `O técnico gasta uma carta: sai ${outName}, entra ${inName}.`,
    `${outName} saiu de cabeça erguida. ${inName} entra com a boca a salivar.`,
    `O banco mexeu: ${inName} entra no lugar de ${outName} para refrescar ideias.`,
    `${outName} fez a sua parte. Agora é a vez de ${inName} brilhar.`,
    `Mudança ofensiva? Tática? O que importa é que ${inName} substitui ${outName}.`,
    `${inName} foi chamado ao círculo e entra. ${outName} senta-se a ver.`,
    `Mais uma troca: ${outName} cede a braçadeira de minutos a ${inName}.`,
    `${inName} estreia-se no jogo. ${outName} deixa o campo com a história feita.`,
    `Substituição para refrescar: ${inName} troca com ${outName} e o ritmo muda.`,
  ]);
}

function nearMissPhrase(name: string): string {
  return pickPhrase([
    `Que remate de ${name}! A bola passou a centímetros do poste. Quase.`,
    `${name} atirou com tudo… e foi por cima da trave. A baliza ficou intacta mas tremia.`,
    `Boa oportunidade desperdiçada por ${name}. Estava mesmo ali.`,
    `${name} disparou de primeira — o guarda-redes espalmou para canto com os punhos. Que reflexos!`,
    `Cabeceamento de ${name} foi rasteiro mas o guarda-redes mergulhou e defendeu no chão.`,
    `${name} ficou cara a cara com o guarda-redes e… rematou para as mãos dele. Que pena.`,
    `A bola de ${name} bateu na trave e voltou para o campo. O ferro hoje está do outro lado.`,
    `${name} arriscou de fora da área. A bola passou ao lado por muito pouco. Suspirou a bancada.`,
    `Cruzamento tenso, ${name} apareceu ao segundo poste… e falhou o alvo por centímetros.`,
    `${name} recebeu em posição de golo e atirou por cima. Tinha tempo. Faltou frieza.`,
    `Remate em força de ${name} — o guarda-redes viu tarde e desviou para canto com a ponta dos dedos.`,
    `Chapéu de ${name} pareceu golo mas a bola picou mesmo na linha e o guarda-redes atirou para longe.`,
    `Que oportunidade para ${name}! A bola saiu a rasar o poste.`,
    `${name} remata… e passa a centímetros da trave. Estava tão perto.`,
    `Grande hipótese desperdiçada por ${name}. Era só encostar.`,
    `${name} dispara de primeira — defesa apertada do guarda-redes para canto.`,
    `Cabeceamento de ${name} bem colocado… mas o guarda-redes segurou com segurança.`,
    `${name} ficou isolado… e rematou para defesa fácil do guarda-redes.`,
    `A trave diz não a ${name}. O ferro salvou a equipa adversária.`,
    `${name} tenta de fora da área. Passa muito perto. Suspiro geral.`,
    `Cruzamento perfeito, ${name} aparece… e falha por pouco.`,
    `${name} tinha tudo para marcar… e manda por cima. Que desperdício.`,
    `Remate forte de ${name} — defesa incrível para canto!`,
    `Chapéu de ${name} parecia golo… mas o guarda-redes recupera a tempo.`,
    `${name} remata colocado… e a bola sai a rasar o poste.`,
    `Boa jogada de ${name}, finalização ligeiramente torta.`,
    `${name} aparece em zona perigosa… e a bola não entra por milímetros.`,
    `Remate de ${name} travado no último instante pelo guarda-redes.`,
    `${name} tenta surpreender… mas o guarda-redes estava atento.`,
    `Finalização de ${name} saiu com demasiada força. Passa por cima.`,
    `${name} quase faz o estádio explodir… mas a bola não entra.`,
    `Boa movimentação de ${name}, mas o remate não saiu limpo.`,
    `${name} remata em boa posição… e a defesa respira de alívio.`,
    `A bola de ${name} ainda beijou o poste antes de sair.`,
    `${name} tentou colocar com calma… e errou o alvo por pouco.`,
    `Remate de ${name} bloqueado parcialmente. Vai para canto.`,
    `${name} aparece bem… mas o guarda-redes fecha o espaço.`,
    `Que perigo criado por ${name}! Falta só o golo.`,
    `${name} remata de longe… e a bola sai ao lado com perigo.`,
    `Grande defesa após remate de ${name}. Estava escrito golo.`,
    `${name} falha por muito pouco. A bancada já festejava.`,
    `Oportunidade clara para ${name}… e não entra.`,
    `${name} viu a baliza e atirou com o coração. A bola preferiu o poste.`,
    `A rede respira fundo: o remate de ${name} passou por cima.`,
    `${name} tinha o golo no pé… e deixou-o escapar.`,
    `Remate de ${name} a sair por cima. O estádio solta um ai coletivo.`,
    `${name} tenta o ângulo fechado e falha. Quem nunca?`,
    `A bola foi à procura do golo e ${name} deu-lhe o endereço errado.`,
    `Pressão, cruzamento e cabeçada de ${name}… para fora. Ufa.`,
    `${name} carimba o lance com remate perigoso. O golo ficou no correio.`,
    `Grande jogada, grande remate de ${name}, grande… poste.`,
    `A defesa agradece a ${name} por não ter sido mais perfeito.`,
    `${name} perde uma chance de ouro. O banco tem as mãos na cabeça.`,
    `O guarda-redes nem se mexeu: a bola de ${name} passou ao lado.`,
    `Mais um ensaio de golo. ${name} já tem o palco, falta o espetáculo.`,
    `O ferro trava ${name}. Nesta tarde, o metal manda.`,
    `${name} tenta a sorte de longe. A sorte estava em outro estádio.`,
  ]);
}

function bigSavePhrase(grName: string): string {
  return pickPhrase([
    `Que defesa de ${grName}! Atirou-se para o canto e tirou a bola quase da linha.`,
    `${grName} voou! Defesa impossível que valeu o ponto. Herói da tarde.`,
    `Um a um, ${grName} saiu bem e fechou o ângulo. O avançado não teve para onde atirar.`,
    `${grName} adivinhou o canto e defendeu com a mão esquerda. Instinto puro.`,
    `Defesa de classe mundial de ${grName}. A bola parecia certeira — ele disse que não.`,
    `${grName} atirou-se aos pés do adversário e bloqueou o remate. Corajoso e eficaz.`,
    `Canto superior esquerdo, remate cruzado — ${grName} esticou-se todo e tocou para fora. Incrível.`,
    `${grName} saiu a tempo do cruzamento e agarrou a bola com firmeza. Sem chances para o avançado.`,
    `Que defesa de ${grName}! Foi buscar uma bola que já se gritava golo.`,
    `${grName} voa e nega o golo com uma intervenção fantástica.`,
    `Defesa enorme de ${grName}. O avançado já tinha festejado por dentro.`,
    `${grName} fecha a baliza com autoridade. Não há passagem possível.`,
    `Reflexos de outro nível de ${grName}! Defende quase em cima da linha.`,
    `${grName} estica-se todo e salva a equipa com uma mão milagrosa.`,
    `Que momento de ${grName}! Defesa segura quando tudo parecia perdido.`,
    `${grName} sai rápido e encurta o ângulo. O remate morreu ali.`,
    `Defesa decisiva de ${grName}. Vale tanto como um golo.`,
    `${grName} lê o lance antes de todos e trava o perigo.`,
    `O avançado remata… e ${grName} responde com uma defesa espetacular.`,
    `Intervenção segura de ${grName}. Nada passa hoje.`,
    `${grName} mergulha e desvia para canto com categoria.`,
    `Defesa fantástica de ${grName}! Instinto puro em ação.`,
    `${grName} mantém a equipa viva com uma parada crucial.`,
    `Grande estirada de ${grName}. A bola não entra.`,
    `${grName} sai dos postes no momento certo e resolve.`,
    `Defesa difícil de ${grName}. Era golo quase certo.`,
    `${grName} mostra nervos de aço e impede o golo.`,
    `Parada monumental de ${grName}! O estádio reage em choque.`,
    `${grName} estica o braço e salva no limite.`,
    `Que leitura de jogo de ${grName}! Antecipou tudo.`,
    `${grName} bloqueia com segurança e afasta o perigo.`,
    `Defesa com reflexos instantâneos de ${grName}. Impressionante.`,
    `${grName} nega o golo com uma intervenção decisiva.`,
    `Salva incrível de ${grName}! A equipa agradece.`,
    `${grName} fecha o canto e evita o pior.`,
    `Defesa de classe de ${grName}. Muito bem colocado.`,
    `${grName} reage rápido e manda para canto.`,
    `Defesa monumental de ${grName}! O relvado aplaude o guardião.`,
    `${grName} faz um milagre de rotina. Já ninguém se surpreende.`,
    `A bola seguia para o golo até ${grName} lembrar-se de que tem asas.`,
    `${grName} nega o golo com o rosto. Coragem pura, dor contida.`,
    `O avançado ainda celebrava… ${grName} já tinha defendido.`,
    `Defesa de pés: ${grName} sai aos pés do avançado e resolve no chão.`,
    `${grName} voa para o lado certo e o golo fica pela imaginação.`,
    `A bancada adversária engole o golo. ${grName} engoliu a bola.`,
    `Dois para um, e o vencedor foi ${grName}.`,
    `${grName} mostra os dois punhos: nem para canto, agarrada.`,
    `A bola tinha destino… ${grName} mudou-lhe a morada.`,
  ]);
}

function weatherPhrase(condition: string): string {
  const pools: Record<string, string[]> = {
    sol: [
      `Tarde soalheira para o jogo de hoje. Relvado perfeito, público à espera.`,
      `Sol de rachar no estádio. As equipas precisam de água — o jogo está quente antes de começar.`,
      `Dia de bom tempo. Condições ideais para um bom espectáculo.`,
      `Tarde soalheira para o jogo de hoje. Relvado impecável e tudo pronto para espectáculo.`,
      `Sol forte no estádio. Vai ser preciso gerir bem a energia lá dentro.`,
      `Dia perfeito de futebol. Condições ideais para uma grande partida.`,
      `Sol no estádio e relvado impecável. Hoje só falta o espetáculo.`,
      `Tarde de verão na bola. Os guarda-redes vão agradecer os reflexos à sombra.`,
      `Calor lá fora, pressão lá dentro. O sol não vai ajudar ninguém a pensar.`,
    ],
    chuva: [
      `Está a chover no estádio. O relvado vai escorregar, a bola vai rolar mais rápido. Cuidado.`,
      `Chuva miúda no arranque da partida. Os jogadores já trouxeram as chuteiras de barro.`,
      `Tempo húmido e relvado pesado. Quem jogar mais directo tem vantagem hoje.`,
      `Chuva leve a cair no estádio. O relvado já começa a ficar traiçoeiro.`,
      `Está a chover e a bola vai ganhar vida própria hoje.`,
      `Relvado molhado e jogo mais rápido. Quem escorregar primeiro paga o preço.`,
      `Chuva miúda e persistente. Vai ser preciso atrevimento para arriscar de longe.`,
      `Gota a gota, o relvado fica traiçoeiro. Os guarda-redes andam alerta.`,
      `Molhado lá fora, molhado no relvado. Hoje o escorrega é parte do jogo.`,
    ],
    chuva_forte: [
      `Aguaceiro forte antes do apito inicial. Visibilidade reduzida, relvado encharcado. Isto vai ser difícil.`,
      `Chuva torrencial no estádio! O árbitro avaliou as condições… e decidiu jogar na mesma.`,
      `Mau tempo de fazer ficar em casa. Quem está cá, está mesmo comprometido.`,
      `A chuva é intensa no estádio. Visibilidade reduzida e relvado encharcado.`,
      `Aguaceiro forte antes do apito inicial. Isto promete dificuldades para todos.`,
      `Condições duras! Chuva torrencial a transformar o relvado num desafio extra.`,
      `Água a cair aos baldes. O jogo vai ganhar velocidade e perder controlo.`,
      `Tempestade a ameaçar. Os avançados já sonham com desvios na água.`,
      `A chuva não dá tréguas. A bola não vai ficar parada muito tempo.`,
    ],
    vento: [
      `Vento forte hoje. As bolas paradas vão ser uma lotaria — para ambos os lados.`,
      `Ventania no estádio. Os guarda-redes vão ter dificuldades com as bolas altas.`,
      `Tarde ventosa. Os cruzamentos vão ser imprevisíveis e os remates de longe, perigosos.`,
      `Vento forte no estádio. Cruzamentos e bolas longas vão ser imprevisíveis.`,
      `Rajadas de vento a complicar a vida aos guarda-redes hoje.`,
      `Dia ventoso. A bola não vai pedir licença a ninguém antes de mudar de direção.`,
      `Vento a atravessar o estádio. Os remates de longe vão ganhar vida própria.`,
      `Rajada forte e a bola muda de ideias no meio do voo. Dia dos guarda-redes heróis.`,
      `O vento assopra ao contrário. Melhor jogar por baixo do que por alto.`,
    ],
    frio: [
      `Faz frio. Os jogadores aqueceram muito antes do jogo — e vão continuar a tentar aquecer no relvado.`,
      `Temperatura baixa no estádio. Dedos gelados nos bancos, pés pesados em campo.`,
      `Noite fria. Aqui precisa-se de movimento constante para não solidificar.`,
      `Está frio no estádio. Jogadores a aquecer bem antes do início.`,
      `Temperatura baixa e ambiente gelado. Vai ser preciso intensidade para aquecer isto.`,
      `Noite fria de futebol. Cada sprint vale como aquecimento extra.`,
      `Frio de rachar. As substituições vão ser mais uma guerra de manta e cobertor.`,
      `Temperatura negativa? Nem tanto, mas o suficiente para os bancos tremerem.`,
      `Frio que afia o apetite. Vão ser 90 minutos a correr para não gelar.`,
    ],
    nevoeiro: [
      `Nevoeiro no estádio. Mal se vê a baliza do lado oposto — e os adeptos das bancadas ainda menos.`,
      `Visibilidade reduzida pela neblina. Vai ser difícil acompanhar o jogo em tempo real.`,
      `Nevoeiro cerrado. O árbitro certificou-se que conseguia ver os dois postes antes de apitar.`,
      `Nevoeiro a cobrir o estádio. Visibilidade bastante reduzida.`,
      `Neblina densa no ar. Dificuldade em ver o outro lado do campo.`,
      `O nevoeiro domina o estádio. O jogo vai exigir atenção redobrada.`,
      `Nevoeiro cerrado: o relvado parece um conto de terror às três da tarde.`,
      `Mal se distingue a linha de fundo. Os árbitros vão pedir calma e foco.`,
      `A neblina esconde os protagonistas. Hoje vale mais ouvidos que olhos.`,
    ],
    neve: [
      `Está a nevar! Relvado branco, bola laranja, condições de sonho para quem não tem que jogar.`,
      `Neve fina cobre o relvado. Vão ser noventa minutos de patinagem artística involuntária.`,
      `Que cenário! Neve a cair durante o aquecimento. O jogo vai ter um ambiente único.`,
      `Está a nevar no estádio! Relvado branco e condições pouco habituais.`,
      `Neve a cair durante o jogo. Cenário raro e complicado para todos.`,
      `Campo coberto de neve. Vai ser um jogo de adaptação constante.`,
      `Neve a cair durante o jogo. Quem marcar agora entra na história e nas fotografias.`,
      `Relvado branco e linha de falta apagada. É preciso imaginação para julgar.`,
      `Neve pelo estádio. O marcador pode ficar congelado — o que não impede golos.`,
    ],
  };
  return pickPhrase(
    pools[condition] || [`Condições variáveis no estádio hoje.`],
  );
}

function extraTimeStartPhrase(): string {
  return pickPhrase([
    `Começa o prolongamento. Mais 30 minutos para decidir tudo.`,
    `Sem vencedor no tempo regulamentar: arranca o prolongamento.`,
    `As pernas pesam, mas a decisão continua adiada. Prolongamento em jogo.`,
    `Recomeça a batalha no minuto 91. Está aberto o prolongamento.`,
    `Ninguém cedeu nos 90 minutos. Agora decide-se no prolongamento.`,
    `Começa o prolongamento. Mais 30 minutos para alguém desbloquear isto.`,
    `Sem vencedor no tempo regulamentar: entra-se no prolongamento com tudo em aberto.`,
    `As pernas pesam, a cabeça também… mas o prolongamento não espera por ninguém.`,
    `Recomeça a batalha no minuto 91. Agora é sobreviver e decidir.`,
    `Nada resolvido em 90 minutos. O prolongamento promete sofrimento e decisão.`,
    `Prolongamento em andamento. Quem marcar agora pode escrever a história.`,
    `Segue tudo empatado. Mais meia hora para encontrar um vencedor.`,
    `O árbitro dá o sinal. Prolongamento em ação.`,
    `Equipas de volta ao relvado com as pernas pesadas e o coração cheio.`,
    `O árbitro dá o sinal para mais 30 minutos de drama.`,
    `Tudo em aberto no prolongamento: a fatura ainda não está paga.`,
    `Mais 30 minutos de futebol puro. O relvado vai pedir férias.`,
    `O relógio recomeça aos 91. O cansaço não vai perdoar ninguém.`,
    `Prolongamento confirmado! O adversário já apontava o relógio.`,
    `Sem golos no tempo regulamentar? Que venham os 30 minutos da verdade.`,
  ]);
}

function finalStartPhrase(): string {
  return pickPhrase([
    `Chegou a final da Taça de Portugal. No Jamor, tudo começa agora.`,
    `Final em andamento no Estádio do Jamor. A história está para escrever.`,
    `Chegamos ao Jamor. A final da Taça de Portugal está a decorrer.`,
    `Estádio do Jamor em ebulição. A final já arrancou e não há volta atrás.`,
    `Chegou a hora da final. Jamor, Taça, emoção — está tudo em jogo.`,
    `O Jamor recebe a final da Taça de Portugal. Quem levanta a taça?`,
    `Final no Jamor. Um jogo, uma taça, uma história para a eternidade.`,
    `Jamor em festa. A final da Taça de Portugal arrancou com tudo.`,
    `Chegámos ao Jamor. A batalha pela Taça de Portugal começa agora.`,
    `Final da Taça no Estádio do Jamor. A emoção é total.`,
    `O Jamor está composto. A Taça já brilha no centro do relvado.`,
    `Um jogo de 90 minutos decide a época no Jamor. História a ser escrita.`,
    `Bancadas cheias no Jamor. A final promete ser uma noite para nunca esquecer.`,
  ]);
}

function finalGoalPhrase(name: string): string {
  return pickPhrase([
    `GOLOOO! ${name} abre o marcador no Jamor! A final tem nome!`,
    `${name} marca no Jamor! A Taça de Portugal tem um passo mais perto!`,
    `Golo no Jamor! ${name} escreve o primeiro capítulo da final.`,
    `GOLO! ${name} no Jamor, no lugar certo, no momento certo. Taça a caminho.`,
    `${name} marca na final! Jamor em êxtase com este golo!`,
    `Golo de ${name} no Jamor! A Taça de Portugal vai ter novo dono.`,
    `GOLOOO! ${name} desperta o Jamor! A final muda de figura!`,
    `${name} abre o marcador na final! Jamor a tremer com este golo!`,
    `Golo no Jamor! ${name} já sonha com a taça levantada.`,
    `GOLO! ${name} no Jamor, no grande jogo. A Taça está a chegar.`,
    `Jamor em festa! ${name} marca na final e faz a bancada explodir!`,
    `Golo de ${name} na final! O Jamor reconhece a classe.`,
    `GOLOOO! ${name} escreve a história no Jamor! Taça quase a caminho!`,
    `${name} marca no Jamor! A Taça de Portugal tem um favorito.`,
    `Golo no Jamor! ${name} já é lenda viva neste estádio.`,
    `GOLOOO! ${name} decide na final e o Jamor enlouquece.`,
    `${name} marca no Jamor e o sonho da taça ganha forma.`,
    `Golo de ${name} na final! As bancadas ainda não acreditam no que viram.`,
    `${name} empurra a Taça para o seu lado. Que noite no Jamor!`,
    `O Jamor inclina-se para o lado de ${name}. A Taça ajeitou-se.`,
    `${name} assina o golo da final e a história do clube muda de página.`,
    `GOLO! ${name} no Jamor, na grande final. O jogo do ano tem nome.`,
    `A bola encontrou ${name} no momento certo. A final também encontrou o seu herói.`,
  ]);
}

function finalEndPhrase(winnerName: string): string {
  return pickPhrase([
    `Jamor em festa! ${winnerName} levanta a Taça de Portugal!`,
    `Final no Jamor a terminar! ${winnerName} é o rei da Taça!`,
    `Taça de Portugal para ${winnerName}! O Jamor grita o nome do campeão!`,
    `${winnerName} vence a final no Jamor! Taça de Portugal — nova!`,
    `O Jamor guarda o segredo de ${winnerName} — campeão da Taça de Portugal!`,
    `Final da Taça a terminar! ${winnerName} no Jamor, campeão!`,
    `Taça de Portugal 2026: ${winnerName} no Jamor, imponente!`,
    `${winnerName} ergue a Taça! Jamor em pé, a festejar o campeão!`,
    `Fim! ${winnerName} é o campeão da Taça de Portugal no Jamor!`,
    `O Jamor rende-se a ${winnerName}. Taça levantada, festa total.`,
    `${winnerName} conquista a Taça de Portugal! O estádio é deles.`,
    `Gritos, confetis e Taça no ar. ${winnerName} escreveu o nome na história.`,
    `Taça para ${winnerName}! O Jamor fecha o espetáculo em apoteose.`,
    `${winnerName} é o novo campeão da Taça! A caminhada valeu a pena.`,
  ]);
}

function secondHalfTacticPhrase(
  homeName: string,
  homeFormation: string,
  homeStyle: string,
  awayName: string,
  awayFormation: string,
  awayStyle: string,
): string {
  const styleLabel = (s: string) => {
    const style = String(s || "").trim().toUpperCase();
    switch (style) {
      case "OFENSIVO":
      case "OFFENSIVE":
        return "estilo ofensivo";
      case "DEFENSIVO":
      case "DEFENSIVE":
        return "estilo defensivo";
      default:
        return "equilibrado";
    }
  };
  return pickPhrase([
    `Segunda parte em curso. ${homeName} mantém o ${homeFormation} ${styleLabel(homeStyle)} — o ${awayName} entrou com um ${awayFormation} ${styleLabel(awayStyle)}.`,
    `As equipas voltam do balneário. ${homeName} de ${homeFormation} ${styleLabel(homeStyle)}, o ${awayName} com um ${awayFormation} ${styleLabel(awayStyle)}.`,
    `Apito inicial da segunda parte. ${homeName} apostou no ${homeFormation} ${styleLabel(homeStyle)}, enquanto o ${awayName} reajustou para ${awayFormation} ${styleLabel(awayStyle)}.`,
    `Recomeço decidido nos balneários: ${homeName} com ${homeFormation} ${styleLabel(homeStyle)} e ${awayName} com ${awayFormation} ${styleLabel(awayStyle)}.`,
    `O intervalo ditou as escolhas. ${homeName} segue com ${homeFormation} ${styleLabel(homeStyle)}, o ${awayName} responde com ${awayFormation} ${styleLabel(awayStyle)}.`,
    `Segunda parte arrancada. ${homeName} com ${homeFormation} ${styleLabel(homeStyle)}, ${awayName} com ${awayFormation} ${styleLabel(awayStyle)} — as tácticas estão definidas.`,
    `Bola a rolar novamente. ${homeName} opta por ${homeFormation} ${styleLabel(homeStyle)}, o ${awayName} apresenta-se com ${awayFormation} ${styleLabel(awayStyle)}.`,
    `Reinício com novidades táticas. ${homeName} em ${homeFormation} ${styleLabel(homeStyle)}, ${awayName} em ${awayFormation} ${styleLabel(awayStyle)}.`,
    `O intervalo mexeu com tudo: ${homeName} com ${homeFormation} ${styleLabel(homeStyle)} e o ${awayName} de ${awayFormation} ${styleLabel(awayStyle)}.`,
    `Novas instruções nos balneários. ${homeName} com ${homeFormation} ${styleLabel(homeStyle)}, o ${awayName} com ${awayFormation} ${styleLabel(awayStyle)}.`,
    `A segunda parte arranca com escolhas diferentes: ${homeName} em ${homeFormation} ${styleLabel(homeStyle)}, ${awayName} em ${awayFormation} ${styleLabel(awayStyle)}.`,
  ]);
}

function tacticStartPhrase(
  homeName: string,
  homeFormation: string,
  homeStyle: string,
  awayName: string,
  awayFormation: string,
  awayStyle: string,
): string {
  const styleLabel = (s: string) => {
    const style = String(s || "").trim().toUpperCase();
    switch (style) {
      case "OFENSIVO":
      case "OFFENSIVE":
        return "estilo ofensivo";
      case "DEFENSIVO":
      case "DEFENSIVE":
        return "estilo defensivo";
      default:
        return "equilibrado";
    }
  };
  return pickPhrase([
    `A ${homeName} estreia-se com um ${homeFormation} ${styleLabel(homeStyle)}, enquanto o ${awayName} opta por um ${awayFormation} ${styleLabel(awayStyle)}.`,
    `No grande jogo, ${homeName} joga de ${homeFormation} ${styleLabel(homeStyle)} contra o ${awayName} a ${awayFormation} ${styleLabel(awayStyle)}.`,
    `${homeName} prepara-se para um ${homeFormation} ${styleLabel(homeStyle)} e o ${awayName} responde com um ${awayFormation} ${styleLabel(awayStyle)}.`,
    `Chegou a hora do confronto. ${homeName} aposta no ${homeFormation} ${styleLabel(homeStyle)} e o ${awayName} no ${awayFormation} ${styleLabel(awayStyle)}.`,
    `Táticas definidas: ${homeName} de ${homeFormation} ${styleLabel(homeStyle)} e ${awayName} de ${awayFormation} ${styleLabel(awayStyle)}.`,
    `${homeName} começa com um ${homeFormation} ${styleLabel(homeStyle)} — o ${awayName} responde com um ${awayFormation} ${styleLabel(awayStyle)}.`,
    `O ${homeName} estreia-se com um ${homeFormation} ${styleLabel(homeStyle)}, ao passo que o ${awayName} opta por um ${awayFormation} ${styleLabel(awayStyle)}.`,
    `Duas equipas, duas tácticas. ${homeName} de ${homeFormation} ${styleLabel(homeStyle)} contra o ${awayName} ${awayFormation} ${styleLabel(awayStyle)}.`,
    `As equipas tomam posição. ${homeName} com um ${homeFormation} ${styleLabel(homeStyle)} e o ${awayName} com um ${awayFormation} ${styleLabel(awayStyle)}.`,
    `${homeName} e ${awayName} fazem as suas escolhas. Primeira: ${homeFormation} ${styleLabel(homeStyle)}. Segunda: ${awayFormation} ${styleLabel(awayStyle)}.`,
    `As táticas estão no papel. ${homeName} com ${homeFormation} ${styleLabel(homeStyle)}, o ${awayName} com ${awayFormation} ${styleLabel(awayStyle)}.`,
    `Às ordens do técnico: ${homeName} joga em ${homeFormation} ${styleLabel(homeStyle)}; o ${awayName} responde em ${awayFormation} ${styleLabel(awayStyle)}.`,
    `Duelo de pranchetas: ${homeFormation} ${styleLabel(homeStyle)} para ${homeName}, ${awayFormation} ${styleLabel(awayStyle)} para ${awayName}.`,
  ]);
}

// ── Pre-match betting intro ───────────────────────────────────────────────
// Modelo determinístico baseado na força das equipas (divisão + posição).
// É a fonte única de verdade: o nextMatchSummary e o evento de apostas do
// minuto 1 usam esta mesma função, garantindo odds idênticas no TacticsView
// e durante o jogo. Sem seed — o resultado depende apenas das equipas.
//
// A força combina a divisão (gap estrutural: uma equipa da 1ª divisão é muito
// mais forte que uma da 4ª) com a posição dentro da divisão. Em jogos da Taça
// a posição é desconhecida (null) → usa-se apenas a divisão.

const ODDS_TEAM_COUNT = 8; // equipas por divisão
const ODDS_DIVISION_BASE = [55, 40, 27, 15, 5]; // div 1..5
const ODDS_HOME_ADVANTAGE = 3;
const ODDS_MAX_ODDS = 67;
const ODDS_MARGIN = 1.05;

interface OddsTeam {
  division?: number | null;
  position?: number | null;
}

function oddsStrength(team: OddsTeam): number {
  const division = Math.max(1, Math.min(5, Math.round(team?.division ?? 4)));
  const base = ODDS_DIVISION_BASE[division - 1] ?? 15;
  const position = team?.position ?? (ODDS_TEAM_COUNT + 1) / 2;
  return base + ((ODDS_TEAM_COUNT + 1) / 2 - position) * 3;
}

export function computeMatchOdds(
  home: OddsTeam,
  away: OddsTeam,
): { home: string; draw: string; away: string } {
  const sHome = oddsStrength(home);
  const sAway = oddsStrength(away);
  const diff = sHome + ODDS_HOME_ADVANTAGE - sAway;

  const expHome = Math.pow(10, diff / 45);
  const expAway = Math.pow(10, -diff / 45);
  const winHome = expHome / (expHome + expAway);
  const winAway = expAway / (expHome + expAway);

  // Empate mais provável quando as equipas estão equilibradas.
  const closeness = Math.exp(-Math.abs(diff) / 30);
  const pDraw = 0.22 + 0.08 * closeness;

  let pHome = winHome * (1 - pDraw);
  let pAway = winAway * (1 - pDraw);

  // Limitar o underdog para evitar odds absurdas (ex.: 4ª divisão vs 1ª).
  const minP = 1 / (ODDS_MAX_ODDS * ODDS_MARGIN);
  if (pHome < minP) pHome = minP;
  if (pAway < minP) pAway = minP;

  const toOdds = (p: number) =>
    p > 0.01 ? (Math.round((1 / (p * ODDS_MARGIN)) * 100) / 100).toFixed(2) : "—";
  return { home: toOdds(pHome), draw: toOdds(pDraw), away: toOdds(pAway) };
}

export function bettingPhrase(
  homeName: string,
  awayName: string,
  odds: { home: string; draw: string; away: string },
): string {
  return pickPhrase([
    `A casa de apostas pesa ${homeName}: ${odds.home} (1) · ${odds.draw} (X) · ${odds.away} (2) ${awayName}.`,
    `As odds de abertura: ${homeName} a ${odds.home}, empate a ${odds.draw}, ${awayName} a ${odds.away}.`,
    `Bola ao ar e às cotas: ${odds.home} (1) · ${odds.draw} (X) · ${odds.away} (2). ${homeName} frente a ${awayName}.`,
    `Previsão dos bookmakers antes do pontapé de saída — ${homeName} ${odds.home}, X ${odds.draw}, ${awayName} ${odds.away}.`,
    `Quem leva a aposta? ${homeName} paga ${odds.home}, o empate ${odds.draw}, ${awayName} ${odds.away}.`,
    `Os entendidos não se entendem: ${homeName} ${odds.home}, X ${odds.draw}, ${awayName} ${odds.away}.`,
    `A cotação manda: ${homeName} a ${odds.home}, empate a ${odds.draw}, ${awayName} a ${odds.away}.`,
    `Cartaz para os apostadores: ${odds.home} em ${homeName}, ${odds.draw} no empate, ${odds.away} em ${awayName}.`,
  ]);
}

export {
  pickPhrase,
  goalPhrase,
  ownGoalPhrase,
  penaltyGoalPhrase,
  penaltyMissPhrase,
  varPhrase,
  yellowPhrase,
  redPhrase,
  injuryPhrase,
  subPhrase,
  nearMissPhrase,
  bigSavePhrase,
  weatherPhrase,
  extraTimeStartPhrase,
  finalStartPhrase,
  finalGoalPhrase,
  finalEndPhrase,
  tacticStartPhrase,
  secondHalfTacticPhrase,
};
