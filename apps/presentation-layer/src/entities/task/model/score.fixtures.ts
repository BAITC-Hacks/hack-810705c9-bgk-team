import type { ScoreCard, ScoreCriterionInput, ScoreFieldInput } from "./score";

export function confirmed(value: string): ScoreFieldInput {
  return { value, state: "confirmed", notApplicable: false };
}

export function suggested(value: string): ScoreFieldInput {
  return { value, state: "suggested", notApplicable: false };
}

export function notApplicable(note = ""): ScoreFieldInput {
  return { value: note, state: "confirmed", notApplicable: true };
}

export function criterion(
  position: number,
  metric: string,
  threshold: string,
  state: ScoreCriterionInput["state"] = "confirmed",
): ScoreCriterionInput {
  return { position, metric, threshold, state };
}

export function emptyCard(): ScoreCard {
  return {
    fields: {},
    criteria: [],
    tags: { state: "suggested", roles: [], skills: [] },
  };
}

// Приложение А: эталонная последовательность логистической задачи.
export function appendixDraft(): ScoreCard {
  return {
    fields: {
      "context.current": confirmed(
        "Операторы весь день отвечают клиентам, где их заказ",
      ),
      "context.change": confirmed("Клиент узнаёт статус заказа без оператора"),
      "users.role": confirmed("клиенты"),
      "link.contact": confirmed("it@logistics.example"),
    },
    criteria: [],
    tags: { state: "suggested", roles: [], skills: [] },
  };
}

export function appendixStep1(): ScoreCard {
  const card = appendixDraft();
  card.fields["data.what"] = confirmed(
    "Выгрузка статусов в CSV, документация API",
  );
  card.fields["data.volume"] = confirmed("выгрузка чата за 6 мес.");
  card.fields["data.sample"] = confirmed(
    "https://api.logistics.example/swagger",
  );
  return card;
}

export function appendixStep2(): ScoreCard {
  const card = appendixStep1();
  card.criteria = [
    criterion(1, "доля обращений без оператора", "≥60%"),
    criterion(2, "время ответа", "< 3 с"),
  ];
  card.fields["context.size"] = confirmed("300 обращений в день");
  return card;
}

export function appendixStep3(): ScoreCard {
  const card = appendixStep2();
  card.fields["result.artifact"] = confirmed(
    "Telegram-бот для ответов о статусе заказа",
  );
  card.fields["result.acceptance"] = confirmed("демо + репозиторий");
  return card;
}

export function appendixStep4(): ScoreCard {
  const card = appendixStep3();
  card.tags = {
    state: "confirmed",
    roles: ["backend", "бот-разработчик"],
    skills: ["Python", "REST API", "Telegram Bot API", "Docker"],
  };
  return card;
}

// Seed-карточки каталога: рейтинг получается только через score().
export const SEED_CARDS: {
  theme: string;
  expected: number;
  card: ScoreCard;
}[] = [
  {
    theme: "логистика",
    expected: 91,
    card: {
      fields: {
        "context.current": confirmed(
          "Диспетчеры вручную строят маршруты доставки в Excel",
        ),
        "context.size": confirmed("120 рейсов в день, 4 часа на планирование"),
        "context.change": confirmed(
          "Маршруты строятся автоматически с учётом окон доставки",
        ),
        "data.what": confirmed("Заказы из 1С, адреса точек, парк машин"),
        "data.volume": confirmed("история рейсов за 2 года"),
        "data.sample": confirmed(
          "заказ;адрес;окно\n101;Алматы, Абая 10;09:00-12:00\n102;Алматы, Сатпаева 5;12:00-15:00\n103;Алматы, Жандосова 2;15:00-18:00",
        ),
        "result.artifact": confirmed(
          "Сервис оптимизации маршрутов с картой для диспетчера",
        ),
        "result.acceptance": confirmed("демо на реальных данных + репозиторий"),
        "constraints.deadline": confirmed("до 15 декабря"),
        "constraints.other": confirmed(
          "данные клиентов не выносить из контура",
        ),
        "users.role": confirmed("диспетчеры склада"),
        "users.scale": confirmed("6 диспетчеров, утренняя смена"),
        "link.contact": confirmed("@route_lead в Telegram"),
        "link.cadence": confirmed("созвон раз в неделю по средам"),
        "link.response": suggested("ответим в течение 3 рабочих дней"),
      },
      criteria: [
        criterion(1, "сокращение пробега", "на 10%"),
        criterion(2, "время планирования", "< 30 мин"),
        criterion(3, "удобство для диспетчера", "диспетчеры довольны"),
      ],
      tags: {
        state: "suggested",
        roles: ["backend", "data scientist"],
        skills: ["Python", "OR-Tools"],
      },
    },
  },
  {
    theme: "производство",
    expected: 76,
    card: {
      fields: {
        "context.current": confirmed(
          "Брак на линии розлива замечают только на выходном контроле",
        ),
        "context.size": confirmed("до 3% брака в смену"),
        "context.change": confirmed(
          "брак выявляется на линии в момент розлива",
        ),
        "data.what": confirmed("Фото с камер линии, журнал брака"),
        "data.volume": confirmed("фото за 3 месяца"),
        "data.sample": suggested("пришлём папку с примерами позже"),
        "result.artifact": confirmed(
          "Модель компьютерного зрения для поиска брака",
        ),
        "result.acceptance": suggested("демо на заводе"),
        "constraints.deadline": confirmed("8 недель"),
        "constraints.other": confirmed("съёмка только внутри цеха"),
        "users.role": confirmed("операторы линии розлива"),
        "users.scale": suggested("12 операторов в три смены"),
        "link.contact": confirmed("quality@plant.example"),
        "link.cadence": confirmed("чат с технологом, ответ в рабочее время"),
        "link.response": confirmed("ответим быстро"),
      },
      criteria: [
        criterion(1, "полнота обнаружения брака", "≥ 90%"),
        criterion(2, "ложные срабатывания", "не более 5%"),
        criterion(3, "интеграция с линией", "без остановки линии"),
      ],
      tags: { state: "confirmed", roles: ["ML-инженер"], skills: [] },
    },
  },
  {
    theme: "образование",
    expected: 58,
    card: {
      fields: {
        "context.current": confirmed(
          "Кураторы вручную проверяют домашние задания по программированию",
        ),
        "context.size": confirmed("проверок очень много"),
        "context.change": confirmed("студенты получают обратную связь сразу"),
        "data.what": confirmed("Репозитории студентов и эталонные решения"),
        "result.artifact": confirmed(
          "Сервис автопроверки заданий с отчётом для студента",
        ),
        "constraints.deadline": confirmed("к началу весеннего семестра"),
        "users.role": confirmed("студенты и кураторы курса"),
        "link.contact": confirmed("t.me/edu_curator"),
        "link.response": confirmed("2 дня"),
      },
      criteria: [
        criterion(1, "доля заданий, проверенных автоматически", "≥ 70%"),
        criterion(2, "понятность отзывов", "студенты понимают замечания"),
      ],
      tags: { state: "suggested", roles: [], skills: [] },
    },
  },
  {
    theme: "ритейл",
    expected: 41,
    card: {
      fields: {
        "context.current": confirmed(
          "Заказ товара в магазины делают по ощущениям управляющего",
        ),
        "context.change": confirmed("заказ рассчитывается по прогнозу продаж"),
        "data.what": confirmed("Чеки из кассовой системы"),
        "constraints.other": notApplicable("ограничений нет"),
        "users.role": confirmed("управляющие магазинами"),
        "link.contact": confirmed("+7 701 555 12 34"),
      },
      criteria: [
        criterion(1, "точность прогноза", "лучше текущей"),
        criterion(2, "удобство отчёта", "понятно управляющим"),
      ],
      tags: { state: "suggested", roles: ["аналитик"], skills: [] },
    },
  },
  {
    theme: "e-commerce",
    expected: 27,
    card: {
      fields: {
        "context.current": confirmed(
          "Карточки товаров менеджеры заполняют вручную",
        ),
        "context.change": confirmed("описания товаров генерируются по фото"),
        "data.what": suggested("фото товаров из каталога"),
        "result.artifact": suggested("скрипт генерации описаний"),
        "constraints.other": confirmed(
          "не использовать персональные данные покупателей",
        ),
        "users.role": confirmed("контент-менеджеры маркетплейса"),
        "link.contact": confirmed("content@shop.example"),
      },
      criteria: [
        criterion(1, "скорость заполнения", "в 2 раза быстрее", "suggested"),
      ],
      tags: { state: "suggested", roles: [], skills: [] },
    },
  },
];
