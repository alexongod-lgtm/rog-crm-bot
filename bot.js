const TelegramBot = require('node-telegram-bot-api');
const express = require('express');
const cors = require('cors');

// 1. ВСТАВЬ СЮДА СВОИ ДАННЫЕ
const TOKEN = '9017961379:AAH1uQEJ4Txc5o89OUlFi0TMqo0WpAIhY14';
const WEB_APP_URL = 'https://sites.google.com/view/rogbarber/full-page-embed/'; // Ссылка на твой виджет Netlify

// 2. БАЗА ДАННЫХ ID (Кто есть кто)
const OWNER_ID = 564704489; // Вставь свой личный ID (узнай в @getmyid_bot)
const MASTERS = {
  '1': 536367354, // Личный ID Никиты Рогова
  '2': 333333333, // Личный ID Максима Белова
  '3': 444444444  // Личный ID Дмитрия Волкова
};

// Инициализация бота и сервера
const bot = new TelegramBot(TOKEN, { polling: true });
const app = express();
app.use(cors());
app.use(express.json());

// ==========================================
// ЛОГИКА РОЛЕЙ: ЧТО ВИДИТ ПОЛЬЗОВАТЕЛЬ ПРИ СТАРТЕ
// ==========================================
bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;

  if (chatId === OWNER_ID) {
    // МЕНЮ ВЛАДЕЛЬЦА
    bot.sendMessage(chatId, '👑 Добро пожаловать в панель владельца "РОГ".', {
      reply_markup: {
        keyboard: [
          ['📊 Статистика за день', '👥 Все записи'],
          ['⚙️ Настройки бота']
        ],
        resize_keyboard: true
      }
    });

  } else if (Object.values(MASTERS).includes(chatId)) {
    // МЕНЮ МАСТЕРА
    bot.sendMessage(chatId, '✂️ Привет, мастер! Вот твоя рабочая панель.', {
      reply_markup: {
        keyboard: [
          ['📅 Мое расписание на сегодня']
        ],
        resize_keyboard: true
      }
    });

  } else {
    // МЕНЮ КЛИЕНТА
    bot.sendMessage(chatId, 'Добро пожаловать в барбершоп РОГ Сочи! 👋\n\nВыберите мастера и удобное время прямо здесь:', {
      reply_markup: {
        inline_keyboard: [
          [{ text: '🗓 Записаться онлайн', web_app: { url: WEB_APP_URL } }]
        ]
      }
    });
  }
});

// ==========================================
// API: ПРИЕМ ЗАЯВОК С ВИДЖЕТА И МАРШРУТИЗАЦИЯ
// ==========================================
app.post('/api/booking', (req, res) => {
  const { masterId, masterName, name, phone, date, time, services, total } = req.body;

  const tgMessage = `🔥 *Новая запись (РОГ Сочи)*\n\n👤 *Имя:* ${name}\n📞 *Телефон:* ${phone}\n\n✂️ *Мастер:* ${masterName}\n📅 *Дата:* ${date}, ${time}\n📋 *Услуги:* ${services.join(', ')}\n💰 *Сумма:* ${total} ₽`;

  // 1. Всегда отправляем копию владельцу
  bot.sendMessage(OWNER_ID, tgMessage, { parse_mode: 'Markdown' }).catch(console.error);

  // 2. Отправляем лично выбранному мастеру
  const specificMasterTgId = MASTERS[masterId];
  if (specificMasterTgId) {
    bot.sendMessage(specificMasterTgId, tgMessage, { parse_mode: 'Markdown' }).catch(console.error);
  }

  res.json({ success: true });
});

// Запуск сервера
const PORT = 3000;
app.listen(PORT, () => {
  console.log(`Сервер CRM запущен на порту ${PORT}. Бот готов к работе!`);
});
