const GamificationService = require('../services/gamificationService');

const mockUserExp = 1500;
const currentLevel = GamificationService.getLevelFromExp(mockUserExp);
console.log('--- GAMIFICATION SIMULATION ---');
console.log('Current EXP:', mockUserExp);
console.log('Calculated Level:', currentLevel);
console.log('EXP needed for current level:', GamificationService.getExpForLevel(currentLevel));
console.log('EXP needed for NEXT level:', GamificationService.getExpForLevel(currentLevel + 1));

const mockTask = { _id: '123', priority: 'high' };
let multiplier = 1;
if (mockTask.priority === 'critical') multiplier = 3;
else if (mockTask.priority === 'high') multiplier = 2;

const expReward = 20 * multiplier;
console.log('Task Completed! Base Reward: 20, Multiplier:', multiplier, '-> Gained', expReward, 'XP');

const newExp = mockUserExp + expReward;
console.log('New EXP:', newExp);
console.log('New Calculated Level:', GamificationService.getLevelFromExp(newExp));
