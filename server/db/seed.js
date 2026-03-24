const db = require('./database');

const divisionsData = {
  1: { teams: ['Triunfo FC', 'Atlético do Norte', 'Desportivo Central', 'União da Serra', 'Estrela da Manhã', 'Guerreiros SC', 'Invicta FC', 'Real Clube'], budget: 50000 },
  2: { teams: ['Academia Sul', 'Leões da Fronteira', 'Bravos de Leste', 'Trovão FC', 'Fénix Azul', 'Pioneiros SC', 'Vanguarda Desportiva', 'Dragões do Vale'], budget: 35000 },
  3: { teams: ['Titãs do Ouro', 'Alvorada FC', 'Centauros AC', 'Falcões de Ferro', 'Gigantes SC', 'Lobos da Planície', 'Meteoros FC', 'Panteras Negras'], budget: 25000 },
  4: { teams: ['Águias Douradas', 'Corsários FC', 'Gladiadores SC', 'Tempestade AC', 'Vulcanos FC', 'Zeus Desportivo', 'Cometas SC', 'Piratas do Mar'], budget: 15000 }
};

const firstA = ['Zal', 'Kael', 'Dorn', 'Val', 'Torn', 'Gor', 'Fen', 'Ryn', 'Zan', 'Morg', 'Sil', 'Cor', 'Jax', 'Tor'];
const firstB = ['is', 'en', 'ar', 'os', 'us', 'ok', 'ir', 'an'];
const lastA = ['Trovão', 'Flecha', 'Rochedo', 'Vendaval', 'Fogo', 'Aço', 'Sombra', 'Luz', 'Gelo', 'Vento'];
const lastB = ['Negro', 'Branco', 'Veloz', 'Forte', 'Bravo', 'Leal', 'Cruel', 'Rápido', 'Feroz', 'Eterno'];

const nationalities = ['ZTR', 'VNT', 'BRR', 'PNN', 'MTR', 'LST', 'GNR', 'FRR'];
const aggressivenessLevels = ['Low', 'Medium', 'Medium', 'Medium', 'High'];

function getRandomName() {
  const isFantasy = Math.random() > 0.5;
  if(isFantasy) {
     const f = firstA[Math.floor(Math.random() * firstA.length)] + firstB[Math.floor(Math.random() * firstB.length)];
     return f.charAt(0).toUpperCase() + f.slice(1) + ' ' + lastA[Math.floor(Math.random() * lastA.length)];
  } else {
     return lastA[Math.floor(Math.random() * lastA.length)] + ' ' + lastB[Math.floor(Math.random() * lastB.length)];
  }
}

db.serialize(() => {
  db.run('DELETE FROM players');
  db.run('DELETE FROM teams');
  db.run('DELETE FROM managers');

  console.log('Seeding 32 fictitious teams and 512 players across 4 divisions...');
  
  const insertManager = db.prepare('INSERT INTO managers (name, reputation) VALUES (?, ?)');
  const insertTeam = db.prepare('INSERT INTO teams (name, manager_id, division, budget) VALUES (?, ?, ?, ?)');
  const insertPlayer = db.prepare('INSERT INTO players (name, position, skill, age, form, aggressiveness, nationality, value, wage, team_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');

  let teamId = 1;
  let managerId = 1;
  
  for (let div = 1; div <= 4; div++) {
    const data = divisionsData[div];
    data.teams.forEach(teamName => {
      // Bot Manager
      const managerName = 'Mr. ' + getRandomName() + ' (' + teamName.split(' ')[0] + ')';
      insertManager.run(managerName, 50);

      insertTeam.run(teamName, managerId, div, data.budget);
      
      const teamPositions = ['GK', 'GK', 'DEF', 'DEF', 'DEF', 'DEF', 'DEF', 'MID', 'MID', 'MID', 'MID', 'MID', 'ATK', 'ATK', 'ATK', 'ATK'];
      
      teamPositions.forEach(pos => {
        const name = getRandomName();
        const baseSkill = 50 - ((div - 1) * 10); 
        let skill = baseSkill + Math.floor(Math.random() * 15) - 5;
        if (skill < 1) skill = 1;
        if (skill > 50) skill = 50;
        
        const age = Math.floor(Math.random() * 16) + 18; // 18 to 34
        const form = Math.floor(Math.random() * 20) + 80; // 80 to 100
        const agg = aggressivenessLevels[Math.floor(Math.random() * aggressivenessLevels.length)];
        const nat = nationalities[Math.floor(Math.random() * nationalities.length)];
        
        const value = skill * 50000;
        let wage = 500;
        if (skill >= 10 && skill < 25) wage = 1000;
        if (skill >= 25 && skill < 40) wage = 2000;
        if (skill >= 40) wage = 5000;
        
        insertPlayer.run(name, pos, skill, age, form, agg, nat, value, wage, teamId);
      });
      teamId++;
      managerId++;
    });
  }

  insertManager.finalize();
  insertTeam.finalize();
  insertPlayer.finalize();

  console.log('Fictitious seed complete. Ready for new sim.');
});

db.close();
