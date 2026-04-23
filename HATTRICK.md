# MIGRAÇÃO PARA MOTOR DO HATTRICK

Para transformarmos o motor do **CashBall** num sistema semelhante ao do **Hattrick**, precisamos de alterar a forma como os atributos (Ataque/Meio-Campo/Defesa) são calculados na função `getPower` e alterar a mecânica principal dentro do loop dos 90 minutos (a função `maybeOpenPlayGoal`).

Aqui está o plano exato do que teríamos de alterar no `engine.ts`:

### 1. Alterar a Função `getPower` (Separar Setores)
Atualmente, o `getPower` mistura os Médios com os Avançados para calcular o "Ataque", e usa os Defesas com o Guarda-Redes para a "Defesa".
**A alteração:** Temos de isolar as 3 linhas do campo.
* **Meio-Campo:** Baseado **apenas** nos Médios (`MED`). Serve exclusivamente para a Posse de Bola.
* **Ataque:** Baseado **apenas** nos Avançados (`ATA`).
* **Defesa:** Baseado nos Defesas (`DEF`) e Guarda-Redes (`GR`).

```javascript
// Onde atualmente está:
const attackBase = avgMidfielderQuality * 0.4 + avgForwardQuality * 0.6;
const defenseBase = avgDefenderQuality * 0.6 + avgKeeperQuality * 0.4;

// Passaria a ser algo como:
const midfieldBase = avgMidfielderQuality; 
const attackBase = avgForwardQuality;
const defenseBase = avgDefenderQuality * 0.7 + avgKeeperQuality * 0.3;

// E o return do getPower passaria a devolver:
return { midfield: midfieldBase, attack: attackBase, defense: defenseBase, style, squad };
```

### 2. Criar a "Batalha da Posse de Bola"
Dentro do loop dos 90 minutos, em vez de ambas as equipas atacarem em simultâneo, calculamos a **Posse de Bola** para esse minuto.

```javascript
// Dentro do for (let minute = startMin; minute <= endMin; minute++) {

const homeMid = currentHome.midfield || 1;
const awayMid = currentAway.midfield || 1;
const homePossessionChance = homeMid / (homeMid + awayMid);

// Lançamos os dados: Quem ganhou o meio-campo neste minuto?
const teamInControl = Math.random() < homePossessionChance ? "home" : "away";
```

### 3. Alterar a função de Golo (Oportunidades Discretas)
Em vez de corrermos `maybeOpenPlayGoal("home")` e `maybeOpenPlayGoal("away")` de forma independente, passamos a criar apenas uma oportunidade esporádica.

Vamos supor que um jogo tem em média 10-15 oportunidades de perigo. A cada minuto, há cerca de 12% a 15% de probabilidade de ser gerada uma chance. Se for gerada, é entregue à `teamInControl`.

```javascript
// Substituir as duas chamadas independentes por:
const chanceOfAction = 0.12; // 12% de chance de haver uma jogada de perigo neste minuto

if (Math.random() < chanceOfAction) {
    // Só a equipa que tem a bola pode atacar!
    processChance(teamInControl); 
}
```

### 4. A Nova Fórmula de Golo (`processChance`)
Quando uma equipa ganha a oportunidade (porque tem a bola e a jogada de perigo ativou), testamos se os Avançados conseguem bater a Defesa adversária.

```javascript
const processChance = (attackingSide) => {
    const attacking = attackingSide === "home" ? currentHome : currentAway;
    const defending = attackingSide === "home" ? currentAway : currentHome;

    // Fórmula Hattrick: probabilidade de sucesso é Ataque vs Defesa
    const ratio = attacking.attack / (attacking.attack + defending.defense);
    
    // Aplicar na mesma a tua mecânica de tempo e penalidade de egos
    let probGoal = ratio * getGoalTimeMultiplier(fixture._minute);
    
    // Teste final
    if (Math.random() < probGoal) {
        // GOLO! (Código atual de registo de golo)
    } else {
        // FALHOU! (Aqui podes emitir o evento near_miss com o guarda-redes a defender)
    }
}
```

### O Impacto Prático desta Mudança:
1. **Os Médios passam a ser os Deuses do jogo** (tal como no Hattrick). Se uma equipa ignorar os Médios e puser só Avançados, vai ter um Ataque tremendo, mas nunca vai ter Posse de Bola para conseguir usá-lo.
2. **Resultados mais consistentes:** As equipas mais fortes vão controlar o jogo inteiro, secando completamente os ataques das equipas fracas. Atualmente, uma equipa fraca pode ter sorte no seu teste independente de 1% e marcar um golo no mesmo minuto em que o adversário também marcou.