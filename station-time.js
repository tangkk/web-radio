(() => {
  const REGION_TIMEZONES = {
    '中央': 'Asia/Shanghai',
    '京津': 'Asia/Shanghai',
    '廣東': 'Asia/Shanghai',
    '江浙滬': 'Asia/Shanghai',
    '香港': 'Asia/Hong_Kong',
    '台灣': 'Asia/Taipei',
    '英國': 'Europe/London',
    '愛爾蘭': 'Europe/Dublin',
    '法國': 'Europe/Paris',
    '瑞士': 'Europe/Zurich',
    '南非': 'Africa/Johannesburg',
    '澳大利亞': 'Australia/Sydney',
    '美國': 'America/New_York',
    '加拿大': 'America/Toronto'
  };

  const LOCATION_TIMEZONES = [
    [/洛杉磯|洛杉矶|los angeles|san diego|聖地牙哥|圣地亚哥/i, 'America/Los_Angeles'],
    [/三藩市|舊金山|旧金山|san francisco|灣區|湾区|san jose|聖荷西|圣何塞/i, 'America/Los_Angeles'],
    [/西雅圖|西雅图|seattle|溫哥華|温哥华|vancouver/i, 'America/Los_Angeles'],
    [/紐約|纽约|new york|波士頓|波士顿|boston|華盛頓|华盛顿|washington/i, 'America/New_York'],
    [/多倫多|多伦多|toronto|渥太華|渥太华|ottawa/i, 'America/Toronto'],
    [/蒙特利爾|蒙特利尔|montreal/i, 'America/Toronto'],
    [/芝加哥|chicago|達拉斯|达拉斯|dallas|休斯敦|休士頓|houston/i, 'America/Chicago'],
    [/丹佛|denver/i, 'America/Denver'],
    [/檀香山|honolulu|夏威夷|hawaii/i, 'Pacific/Honolulu'],
    [/倫敦|伦敦|london/i, 'Europe/London'],
    [/都柏林|dublin/i, 'Europe/Dublin'],
    [/巴黎|paris/i, 'Europe/Paris'],
    [/日內瓦|日内瓦|geneva|蘇黎世|苏黎世|zurich/i, 'Europe/Zurich'],
    [/約翰內斯堡|约翰内斯堡|johannesburg|開普敦|开普敦|cape town/i, 'Africa/Johannesburg'],
    [/悉尼|雪梨|sydney|墨爾本|墨尔本|melbourne|坎培拉|canberra/i, 'Australia/Sydney'],
    [/布里斯本|brisbane/i, 'Australia/Brisbane'],
    [/阿德萊德|阿德莱德|adelaide/i, 'Australia/Adelaide'],
    [/珀斯|伯斯|perth/i, 'Australia/Perth'],
    [/北京|天津|上海|江蘇|江苏|浙江|廣東|广东|廣州|广州|深圳/i, 'Asia/Shanghai'],
    [/香港|hong kong/i, 'Asia/Hong_Kong'],
    [/台北|臺北|台灣|臺灣|taipei|taiwan/i, 'Asia/Taipei']
  ];

  let stationsByName = new Map();
  let clockTimer = null;

  function resolveTimeZone(station) {
    if (station.timeZone) return station.timeZone;
    const location = [station.market, station.name, station.broadcaster].filter(Boolean).join(' ');
    const match = LOCATION_TIMEZONES.find(([pattern]) => pattern.test(location));
    return match?.[1] || REGION_TIMEZONES[station.region] || null;
  }

  function formatLocalTime(timeZone) {
    return new Intl.DateTimeFormat('zh-Hant', {
      timeZone,
      weekday: 'short',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23'
    }).format(new Date());
  }

  function updateClocks() {
    document.querySelectorAll('.station-local-time[data-time-zone]').forEach(clock => {
      try {
        clock.textContent = `當地 ${formatLocalTime(clock.dataset.timeZone)}`;
      } catch (error) {
        clock.textContent = '當地時間不可用';
      }
    });
  }

  function decorateCards() {
    document.querySelectorAll('#stationList .station').forEach(card => {
      const name = card.querySelector('.station-name')?.textContent?.trim();
      const station = stationsByName.get(name);
      if (!station) return;

      const timeZone = resolveTimeZone(station);
      if (!timeZone) return;

      let clock = card.querySelector('.station-local-time');
      if (!clock) {
        clock = document.createElement('div');
        clock.className = 'station-local-time';
        card.querySelector('.station-info')?.append(clock);
      }
      clock.dataset.timeZone = timeZone;
      clock.title = timeZone;
    });
    updateClocks();
  }

  async function initStationTimes() {
    try {
      const response = await fetch('./stations.json');
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const stations = await response.json();
      stationsByName = new Map(stations.map(station => [station.name, station]));
      decorateCards();

      const list = document.querySelector('#stationList');
      if (list) new MutationObserver(decorateCards).observe(list, { childList: true });
      clockTimer = window.setInterval(updateClocks, 30000);
    } catch (error) {
      console.warn('Station local times unavailable:', error);
    }
  }

  window.addEventListener('pagehide', () => {
    if (clockTimer) window.clearInterval(clockTimer);
  });

  initStationTimes();
})();
