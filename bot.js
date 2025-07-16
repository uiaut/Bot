const mineflayer = require('mineflayer');
const { pathfinder, Movements, goals } = require('mineflayer-pathfinder');
const autoeat = require('mineflayer-auto-eat').plugin;
const pvp = require('mineflayer-pvp').plugin;
const collectBlock = require('mineflayer-collectblock').plugin;
const toolPlugin = require('mineflayer-tool').plugin;
const fs = require('fs');
const Vec3 = require('vec3');

const config = JSON.parse(fs.readFileSync('config.json', 'utf8'));

function createBot() {
  const bot = mineflayer.createBot({
    host: config.host,
    port: config.port,
    username: config.username,
    version: config.version || false
  });

  bot.loadPlugin(pathfinder);
  bot.loadPlugin(autoeat);
  bot.loadPlugin(pvp);
  bot.loadPlugin(collectBlock);
  bot.loadPlugin(toolPlugin);

  bot.once('spawn', () => {
    const mcData = require('minecraft-data')(bot.version);
    const defaultMove = new Movements(bot, mcData);
    bot.pathfinder.setMovements(defaultMove);

    bot.autoEat.options = {
      priority: 'foodPoints',
      startAt: 14,
      bannedFood: []
    };

    bot.chat('🤖 ProBot online! Gõ: menu để mở bảng lệnh');
  });

  bot.on('chat', (u, msg) => chatHandler(bot, u, msg));
  bot.on('physicsTick', () => swimAndAvoid(bot));
  bot.on('entityHurt', (e) => {
    if (e.type === 'player' && e.username !== bot.username) bot.pvp.attack(e);
  });
  bot.on('error', console.log);
  bot.on('end', () => setTimeout(createBot, 5000));

  return bot;
}

function chatHandler(bot, username, message) {
  if (username === bot.username) return;
  const target = bot.players[username]?.entity;

  if (message === 'menu') {
    bot.chat(`📋 MENU:
1️⃣ Kiếm đồ
2️⃣ Đào đá
3️⃣ Xây cổng Nether
4️⃣ Tìm Bastion
5️⃣ Nâng cấp Netherite
6️⃣ PvP
7️⃣ Dừng bot`);
    return;
  }

  switch(message) {
    case '1': gatherResources(bot); break;
    case '2': mineStone(bot); break;
    case '3': buildNetherPortal(bot); break;
    case '4': searchBastion(bot); break;
    case '5': upgradeToNetherite(bot); break;
    case '6':
      const enemy = bot.nearestEntity(e => e.type === 'player' && e.username !== bot.username);
      if (enemy) bot.pvp.attack(enemy);
      break;
    case '7':
      bot.pathfinder.setGoal(null);
      bot.clearControlStates();
      bot.chat('⛔ Bot đã dừng.');
      break;
  }
}

function swimAndAvoid(bot) {
  if (bot.entity.isInWater && bot.entity.velocity.y < 0) bot.setControlState('jump', true);
  else bot.setControlState('jump', false);

  const b = bot.blockAt(bot.entity.position.offset(0, -1, 0));
  if (b && b.name.includes('lava')) bot.setControlState('jump', true);
}

async function gatherResources(bot) {
  bot.chat('🪓 Kiếm tài nguyên...');
  const blocks = bot.findBlocks({ matching: b =>
    b.name.includes('log') || b.name.includes('iron_ore') || b.name.includes('wheat'), maxDistance: 64, count: 5 });
  for (const pos of blocks) {
    const block = bot.blockAt(pos);
    if (block) await bot.collectBlock.collect(block);
  }
}

async function mineStone(bot) {
  bot.chat('⛏️ Đang đào đá...');
  const stone = bot.findBlock(b => b.name === 'stone', null, 16);
  if (stone) bot.collectBlock.collect(stone);
  else bot.chat('❌ Không thấy đá.');
}

async function buildNetherPortal(bot) {
  bot.chat('🧱 Xây cổng Nether...');
  const obsidian = bot.inventory.items().filter(i => i.name === 'obsidian');
  const flint = bot.inventory.items().find(i => i.name === 'flint_and_steel');
  if (obsidian.length < 10 || !flint) {
    bot.chat('❌ Thiếu Obsidian hoặc Flint & Steel');
    return;
  }
  const base = bot.entity.position.floored().offset(1, 0, 0);
  const shape = [
    [0,0],[0,1],[0,2],[0,3],[0,4],
    [1,0],[1,4],
    [2,0],[2,1],[2,2],[2,3],[2,4]
  ];
  for (const [x,y] of shape) {
    await bot.placeBlock(bot.blockAt(base.offset(x, -1, 0)), new Vec3(0,1,0));
  }
  bot.chat('🔥 Bật lửa và vào Nether...');
  await bot.equip(flint, 'hand');
  bot.activateBlock(bot.blockAt(base.offset(1,1,0)));
}

async function upgradeToNetherite(bot) {
  const template = bot.inventory.items().find(i => i.name.includes('smithing_template'));
  const ingot = bot.inventory.items().find(i => i.name === 'netherite_ingot');
  const tool = bot.inventory.items().find(i => i.name.includes('diamond'));
  const table = bot.findBlock({ matching: b => b.name === 'smithing_table', maxDistance: 6 });
  if (!template || !ingot || !tool || !table) return bot.chat('❌ Thiếu nguyên liệu hoặc bàn!');
  const t = await bot.openBlock(table);
  await t.putTemplate(template);
  await t.putBase(tool);
  await t.putAddition(ingot);
  await bot.waitForTicks(5);
  await t.takeOutput();
  await t.close();
  bot.chat('✅ Đã nâng cấp Netherite!');
}

async function searchBastion(bot) {
  bot.chat('🚀 Tìm Bastion...');
  const bastion = bot.findBlock({ matching: b => b.name.includes('gilded_blackstone'), maxDistance: 128 });
  if (!bastion) return bot.chat('❌ Không tìm thấy Bastion.');
  bot.chat(`📍 Bastion tại: ${bastion.position}`);
  bot.pathfinder.setGoal(new goals.GoalBlock(bastion.position.x, bastion.position.y, bastion.position.z));
}

createBot();
