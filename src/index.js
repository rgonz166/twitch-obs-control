// const ExpressServer = require('./assets/js/server');
const ObsWebSocket = require('obs-websocket-js');

const obs = new ObsWebSocket();

let currentScenes;
let sceneMap = new Map();
let sourcesMap = new Map();
let groupMap = new Map();
let queueMap = new Map();
let queueRandomMap = new Map();
let randomPercSum = 0
let currentRandomWeightedMap = new Map();

const store = new Store({
  configName: 'obs-proxy-settings',
  defaults: {
    websocket: {
      port: 4444,
      password: '',
    },
    'twitch-user': '',
  },
});

const twitchApiStore = new Store({
  configName: 'twitch-api',
  defaults: {
    'twitch-config': {
      clientId: '98a3op8i9g48ppw3ji60pw6qlcix52',
      oauthToken: '',
    },
  },
});

const pointsSourceToggleStore = new Store({
  configName: 'points-source-toggle-mapping',
  defaults: {
    'points-source': JSON.stringify(new Map()),
  },
});

const pointsRandomWeightedStore = new Store({
  configName: 'points-random-weighted-mapping',
  defaults: {
    'random-weighted': JSON.stringify(new Map())
  }
})

const sourceGroupStore = new Store({
  configName: 'source-group',
  defaults: {
    group: JSON.stringify(new Map()),
  },
});

const bitsSourceToggleStore = new Store({
  configName: 'bits-source-toggle-mapping',
  defaults: {
    'bits-source': JSON.stringify(new Map()),
  },
});

const bitsSourceGroupStore = new Store({
  configName: 'bits-source-group',
  defaults: {
    group: JSON.stringify(new Map()),
  },
});

const navbarTitleEl = document.getElementById('navbar-title');
const twitchUserEl = document.getElementById('twitch-user');
const wsPort = document.getElementById('websocket-port');
const wsPass = document.getElementById('websocket-password');
const snackbarContainer = document.querySelector('#demo-snackbar-example');
const obsConnectBut = document.getElementById('obsConnect');
const obsDisconnectBut = document.getElementById('obsDisconnect');
// Points Reward
const rewardsElement = document.getElementById('rewards');
const obsScenesElement = document.getElementById('scenes');
const obsSourcesElement = document.getElementById('sources');
const timedElement = document.getElementById('time-input');
const groupElement = document.getElementById('group-input');
const randomElement = document.getElementById('random-input');
const rewardVariabilityElement = document.getElementById('reward-variability')
const randomLabelElement = document.getElementById('random-label');
const pointsSourceListEl = document.getElementById('points-source-list');
const rewardGroupSettingsListEl = document.getElementById('random-group-reward-table');
// Bits
const bitsInputElement = document.getElementById('bits-input');
const obsScenesBitsElement = document.getElementById('bit-scenes');
const obsSourcesBitsElement = document.getElementById('bit-sources');
const timedBitsElement = document.getElementById('bit-time-input');
const groupBitsElement = document.getElementById('bit-group-input');
const randomBitsElement = document.getElementById('random-bits-input');
const randomBitsLabelElement = document.getElementById('random-bits-label');
const bitsSourceListEl = document.getElementById('bits-source-list');

const dialog = document.querySelector('dialog');
const showDialogButton = document.querySelector('#show-dialog');
const twitchSaveDialogEl = document.getElementById('twitch-api-save');
const clientIdEl = document.getElementById('twitch-api-client-id-input');
// const clientSecretEl = document.getElementById('twitch-api-client-secret-input');
const oauthTokenEl = document.getElementById('twitch-oauth-input');
const connectTwitchBtnEl = document.getElementById('connect-twitch-btn');
const disconnectTwtichBtnEl = document.getElementById('disconnect-twitch-btn');
const copyTextEl = document.querySelector('.copy');

let { port, password } = store.get('websocket');
let savedTwitchUser = store.get('twitch-user');
let { clientId, oauthToken } = twitchApiStore.get('twitch-config');

if (dialog && !dialog.showModal) {
  dialogPolyfill.registerDialog(dialog);
}
if (showDialogButton) {
  showDialogButton.addEventListener('click', function () {
    dialog.showModal();
  });
}

if (dialog) {
  dialog.querySelector('.close').addEventListener('click', function () {
    dialog.close();
  });
}

copyTextEl.onclick = () => {
  document.execCommand('copy');
  const data = {
    message: '👍🏼 Text Copied',
    timeout: 2000,
  };
  snackbarContainer.MaterialSnackbar.showSnackbar(data);
};

copyTextEl.addEventListener('copy', (event) => {
  event.preventDefault();
  if (event.clipboardData) {
    event.clipboardData.setData('text/plain', copyTextEl.textContent);
  }
});

twitchSaveDialogEl.addEventListener('click', () => {
  oauthToken = oauthTokenEl.value;
  clientId = clientIdEl.value;
  const apiConfig = {
    clientId: clientIdEl.value,
    oauthToken: oauthTokenEl.value,
  };
  twitchApiStore.set('twitch-config', apiConfig);
  clientId = apiConfig.clientId;
  oauthToken = apiConfig.oauthToken;
  dialog.close();
});

document.addEventListener('DOMContentLoaded', (event) => {
  twitchUserEl.value = savedTwitchUser;
  wsPort.value = port;
  wsPass.value = password;
  clientIdEl.value = clientId;
  // clientSecretEl.value = clientSecret;
  oauthTokenEl.value = oauthToken;
  setRewardPointsList(getPointsSourceMap());
  setBitsPointsList(getBitsSourceMap());
  // const app = new ExpressServer(5000);
  // app.start();
});

//TODO Move navbar stuff to separate file


const save = () => {
  port = wsPort.value;
  password = wsPass.value;
  savedTwitchUser = twitchUserEl.value;
  store.set('twitch-user', twitchUserEl.value);
  store.set('websocket', { port: wsPort.value, password: wsPass.value });
  const data = {
    message: '✅ OBS Websocket Settings Saved',
    timeout: 2000,
  };
  snackbarContainer.MaterialSnackbar.showSnackbar(data);
  savedTwitchUser = twitchUserEl.value;
  port = wsPort.value;
  password = wsPass.value;
};

/* OBS Section */

const connectObs = () => {
  const { port, password } = store.get('websocket');
  obs
    .connect({ address: `localhost:${port}`, password: `${password}` })
    .then(() => {
      const data = {
        message: '👍🏼 OBS Connected Successfully',
        timeout: 2000,
      };
      snackbarContainer.MaterialSnackbar.showSnackbar(data);
      toggleObsConnected();
      return obs.send('GetSceneList');
    })
    .then((data) => {
      currentScenes = data.scenes;
      bitsCurrentScenes = data.scenes;
      data.scenes.forEach((scene) => {
        sceneMap.set(scene.name, scene);
      });
    })
    .then((data) => {
      setScenesList();
      setBitsScenesList();
    });

  // You must add this handler to avoid uncaught exceptions.
  obs.on('error', (err) => {
    console.error('socket error:', err);
    const data = {
      message: err,
      timeout: 2000,
    };
    snackbarContainer.MaterialSnackbar.showSnackbar(data);
  });
};

const refreshObsScenes = () => {
  obs
    .send('GetSceneList')
    .then((data) => {
      currentScenes = data.scenes;
      bitsCurrentScenes = data.scenes;
      data.scenes.forEach((scene) => {
        sceneMap.set(scene.name, scene);
      });
    })
    .then(() => {
      setScenesList();
      setBitsScenesList();
    });
};

const disconnectObs = () => {
  obs.disconnect();
  const data = {
    message: '👋🏼 OBS Disconnected Successfully 👋🏼',
    timeout: 2000,
  };
  snackbarContainer.MaterialSnackbar.showSnackbar(data);
  toggleObsConnected();
};

let isConnected = false;
const toggleObsConnected = () => {
  isConnected = !isConnected;
  if (isConnected) {
    obsConnectBut.classList.add('hidden');
    obsDisconnectBut.classList.remove('hidden');
  } else {
    obsConnectBut.classList.remove('hidden');
    obsDisconnectBut.classList.add('hidden');
  }
};

/* Twitch Section */

let isTwitchConnected = false;
const toggleTwitchConnected = () => {
  if (!isTwitchConnected) {
    isTwitchConnected = !isTwitchConnected;
    connectTwitchBtnEl.classList.add('hidden');
    disconnectTwtichBtnEl.classList.remove('hidden');
  }
};

const toggleTwitchDisconnected = () => {
  if (isTwitchConnected) {
    isTwitchConnected = !isTwitchConnected;
    connectTwitchBtnEl.classList.remove('hidden');
    disconnectTwtichBtnEl.classList.add('hidden');
  }
};
ComfyJS.onConnected = () => {
  const data = {
    message: '👍🏼 Twitch Connected Successfully ',
    timeout: 2000,
  };
  snackbarContainer.MaterialSnackbar.showSnackbar(data);
  toggleTwitchConnected();
};

ComfyJS.onError = (err) => {
  const data = {
    message: `🛑 ${err} 🛑`,
    timeout: 4000,
  };
  snackbarContainer.MaterialSnackbar.showSnackbar(data);
  toggleTwitchDisconnected();
  console.log('err', err);
};

const connectTwitch = async () => {
  ComfyJS.Init(savedTwitchUser, `${oauthToken}`, savedTwitchUser);
  getRewards();
  startTwitchListener();
};

const disconnectTwitch = () => {
  ComfyJS.Disconnect();
  const data = {
    message: '👋🏼 Twitch Disconnected Successfully 👋🏼',
    timeout: 2000,
  };
  snackbarContainer.MaterialSnackbar.showSnackbar(data);
  toggleTwitchDisconnected();
};

const getRewards = async () => {
  let channelRewards = await ComfyJS.GetChannelRewards(clientId);
  setRewardsList(channelRewards);
};

const startTwitchListener = () => {
  // ComfyJS
  ComfyJS.onReward = (user, reward, cost, extra) => {
    let currentPointsSourceMap = getPointsSourceMap();
    runToggles(currentPointsSourceMap, reward, user);
  };

  ComfyJS.onCheer = (user, message, bits, flags, extra) => {
    const data = {
      user: user,
      message: message,
      bits: bits,
      flags: flags,
      extra: extra,
    };

    let currentBitsSourceMap = getBitsSourceMap();
    const currentBits = bits.toString();
    runToggles(currentBitsSourceMap, currentBits, user);
  };
};

const runToggles = (map, reward, user) => {
  if (map.has(reward)) {
    const currentSceneSource = map.get(reward);
    if (currentSceneSource) {
      if (currentSceneSource.random) {
        toggleRandomSources(currentSceneSource, user);
      } else {
        const group = currentSceneSource.group;
        if (group === 'None') {
          if (currentSceneSource.time === 0) {
            toggleSpecifiedSource(currentSceneSource.source);
          } else {
            checkQueueStatus(
              currentSceneSource.source,
              currentSceneSource,
              user
            );
          }
        } else {
          toggleGroup(group, reward);
        }
      }
    }
  }
};

const checkQueueStatus = (currentReward, source, user) => {
  if (queueMap.has(currentReward)) {
    const currentActiveReward = queueMap.get(currentReward);
    currentActiveReward.rewardArray.push(user);
    // set reward
    toggleRewardQueue(currentActiveReward);
  } else {
    queueMap.set(currentReward, {
      reward: source,
      rewardArray: [user],
      flag: false,
    });
    const currentActiveReward = queueMap.get(currentReward);
    toggleRewardQueue(currentActiveReward);
  }
};

const checkQueueRandomStatus = (currentReward, folder, sources, user) => {
  if (queueRandomMap.has(currentReward)) {
    const currentActiveReward = queueRandomMap.get(currentReward);
    currentActiveReward.rewardArray.push(user);
    // set reward
    toggleRandomRewardQueue(currentActiveReward);
  } else {
    queueRandomMap.set(currentReward, {
      rewards: sources,
      folder: folder,
      rewardArray: [user],
      flag: false,
    });
    const currentActiveReward = queueRandomMap.get(currentReward);
    toggleRandomRewardQueue(currentActiveReward);
  }
};

const toggleRewardQueue = (queue) => {
  if (!queue.flag) {
    // queue.flag = true;
    const currentActiveReward = queueMap.get(queue.reward.source);
    timedToggleSource(queue.reward.source, queue.reward.time);
  }
};

const toggleRandomRewardQueue = (queue) => {
  if (!queue.flag) {
    // queue.flag = true;
    timedToggleRandomSource(queue.folder.source, queueRandomMap);
  }
};

const toggleGroup = (group, reward) => {
  let currentPointsSourceMap = getPointsSourceMap();
  const currentGroupMap = getStoreMap(sourceGroupStore, 'source-group');
  const groupArray = JSON.parse(currentGroupMap.get(group));
  groupArray.forEach((item) => {
    const currentSceneSource = currentPointsSourceMap.get(item);
    if (item !== reward) {
      toggleOffSpecifiedSource(currentSceneSource.source);
    } else {
      toggleSpecifiedSource(currentSceneSource.source);
    }
  });
};

const toggleBitsGroup = (group, reward) => { };

randomElement.addEventListener('change', (event) => {
  if (event.currentTarget.checked) {
    // alert('checked')
    rewardVariabilityElement.removeAttribute('disabled')
  } else {
    // alert('unchecked')
    rewardVariabilityElement.setAttribute('disabled', true)

  }
})

const variabilityToggle = () => {
  rewardGroupSettingsListEl.classList.toggle('hidden')
}

obsSourcesElement.addEventListener('change', (event) => {
  //TODO go here
  const chosenSource = event.target.value;
  // Check if there is a weighted map if not run the obs send
  const randomWeightedMap = getRandomWeightedMap()
  currentRandomWeightedMap = randomWeightedMap;
  if (randomWeightedMap.has(chosenSource)) {

  } else {
    obs.send('GetSceneList').then(async (data) => {
      const currentScene = data.scenes.filter(scene => scene.name === obsScenesElement.value)
      const currentSource = currentScene[0].sources.filter(source => source.name === chosenSource)[0]
      if (currentSource.type === 'group') {
        const folderSources = currentSource.groupChildren;
        randomWeightedMap.set(chosenSource, folderSources)
        setRandomWeightedMap(randomWeightedMap)
        setRewardWeightedList(folderSources);

      } else {
        console.log('is not group')
      }
      // obsScenesElement
      // obsSourcesElement
    })
  }
})

const addRandomSum = () => {
  randomPercSum = 0
  const randomSums = document.querySelectorAll('[name^=randSum]')
  const addToListButtonEl = document.getElementById('add-to-list');
  const currentRandomWeighted = currentRandomWeightedMap;
  const currentMap = currentRandomWeighted.get(obsSourcesElement.value)
  let currentIndex = 0
  randomSums.forEach((element) => {
    currentMap[currentIndex]['weighted'] = +element.value;
    const currentElementVal = +element.value
    randomPercSum += currentElementVal;
    currentIndex++;
  })
  setRandomWeightedMap(currentMap);

  // Update randomPercSum dom
  const percSumEl = document.getElementById('random-percent-sum');
  percSumEl.innerText = randomPercSum;
  // Check if sum is greater than 0 then disable add to list unless sum is 100
  if (randomPercSum === 0 || randomPercSum === 100) {
    addToListButtonEl.removeAttribute('disabled')
  } else {
    addToListButtonEl.setAttribute('disabled', true)
  }
}

const mapSourceReward = () => {
  const currentReward = rewardsElement.value;
  const sceneVal = obsScenesElement.value;
  const sourceVal = obsSourcesElement.value;
  const numVal = parseFloat(timedElement.value) * 1000;
  const timedVal = numVal === 0 ? 0 : numVal + 1000;
  const groupVal = groupElement.value ? groupElement.value : 'None';
  const randomVal = randomElement.checked ? true : false;
  const isWeighted = randomVal && randomPercSum === 100 ? true : false;
  const weightedSources = isWeighted ? currentRandomWeightedMap : null

  // const randomWeighted = 

  if (
    currentReward &&
    sceneVal &&
    sourceVal &&
    currentReward !== 'not-connected' &&
    sceneVal !== 'not-connected' &&
    sourceVal !== 'not-connected'
  ) {
    let currentPointsSourceMap = getPointsSourceMap();
    currentPointsSourceMap.set(currentReward, {
      scene: sceneVal,
      source: sourceVal,
      time: timedVal,
      group: groupVal,
      random: randomVal,
      isWeighted,
      weightedSources
    });
    console.log('currentPointsSourceMap', currentPointsSourceMap)
    setPointsSourceMap(currentPointsSourceMap);
  } else {
    const data = {
      message: '🛑 Please make sure all services are connected 🛑',
      timeout: 4000,
    };
    snackbarContainer.MaterialSnackbar.showSnackbar(data);
  }
};

const mapSourceBits = () => {
  const currentBitsSelected = bitsInputElement.value;
  const sceneVal = obsScenesBitsElement.value;
  const sourceVal = obsSourcesBitsElement.value;
  const numVal = parseFloat(timedBitsElement.value) * 1000;
  const timedVal = numVal === 0 ? 0 : numVal + 1000;
  const groupVal = groupBitsElement.value ? groupBitsElement.value : 'None';
  const randomBitsVal = randomBitsElement.checked ? true : false;
  const isWeighted = randomBitsVal && randomPercSum === 100 ? true : false;
  const weightedSources = isWeighted ? currentRandomWeightedMap : null

  if (
    currentBitsSelected &&
    sceneVal &&
    sourceVal &&
    currentBitsSelected !== 'not-connected' &&
    sceneVal !== 'not-connected' &&
    sourceVal !== 'not-connected'
  ) {
    let currentBitsSourceMap = getBitsSourceMap();
    currentBitsSourceMap.set(currentBitsSelected, {
      scene: sceneVal,
      source: sourceVal,
      time: timedVal,
      group: groupVal,
      random: randomBitsVal,
      isWeighted,
      weightedSources
    });
    console.log('curerntBitsSourceMap', currentBitsSelected)
    setBitsSourceMap(currentBitsSourceMap);
  } else {
    const data = {
      message: '🛑 Please make sure all services are connected 🛑',
      timeout: 4000,
    };
    snackbarContainer.MaterialSnackbar.showSnackbar(data);
  }
};

const removeSingleSourceReward = (key) => {
  let currentPointsSourceMap = getPointsSourceMap();
  currentPointsSourceMap.delete(key);
  setPointsSourceMap(currentPointsSourceMap);
};

const removeSingleBitsSource = (key) => {
  let currentPointsSourceMap = getBitsSourceMap();
  currentPointsSourceMap.delete(key);
  setBitsSourceMap(currentPointsSourceMap);
};

const getPointsSourceMap = () => {
  return getStoreMap(pointsSourceToggleStore, 'points-source');
};

const setPointsSourceMap = (map) => {
  setStoreMap(pointsSourceToggleStore, 'points-source', map);
  setRewardPointsList(getPointsSourceMap());
};

const getBitsSourceMap = () => {
  return getStoreMap(bitsSourceToggleStore, 'bits-source');
};

const setBitsSourceMap = (map) => {
  setStoreMap(bitsSourceToggleStore, 'bits-source', map);
  setBitsPointsList(getBitsSourceMap());
};

const getRandomWeightedMap = () => {
  return getStoreMap(pointsRandomWeightedStore, 'random-weighted')
}

const setRandomWeightedMap = (map) => {
  setStoreMap(pointsRandomWeightedStore, 'random-weighted', map);

}

const getStoreMap = (store, key) => {
  const currentPointsSource = store.get(key);
  if (
    currentPointsSource &&
    Object.keys(currentPointsSource).length > 0 &&
    currentPointsSource !== '{}'
  ) {
    return new Map(JSON.parse(currentPointsSource));
  } else {
    return new Map();
  }
};

const setStoreMap = (store, key, map) => {
  store.set(key, JSON.stringify(Array.from(map.entries())));
};

const setGroupStoreMapping = () => {
  setStoreMap(sourceGroupStore, 'source-group', new Map());
  const currentMap = getPointsSourceMap();
  currentMap.forEach((val, key) => {
    const groupVal = val.group;
    if (groupVal !== 'None') {
      const currentGroupMap = getStoreMap(sourceGroupStore, 'source-group');
      let currentSet = new Set();
      if (currentGroupMap.has(groupVal)) {
        currentSet = new Set(JSON.parse(currentGroupMap.get(groupVal)));
      }
      currentSet.add(key);
      currentGroupMap.set(groupVal, JSON.stringify(Array.from(currentSet)));
      setStoreMap(sourceGroupStore, 'source-group', currentGroupMap);
    }
  });
};

const setBitGroupStoreMapping = () => {
  setStoreMap(bitsSourceGroupStore, 'bits-source-group', new Map());
  const currentMap = getBitsSourceMap();
  currentMap.forEach((val, key) => {
    const groupVal = val.group;
    if (groupVal !== 'None') {
      const currentBitGroupMap = getStoreMap(
        bitsSourceGroupStore,
        'bits-source-group'
      );
      let currentSet = new Set();
      if (currentBitGroupMap.has(groupVal)) {
        currentSet = new Set(JSON.parse(currentBitGroupMap.get(groupVal)));
      }
      currentSet.add(key);
      currentBitGroupMap.set(groupVal, JSON.stringify(Array.from(currentSet)));
      setStoreMap(
        bitsSourceGroupStore,
        'bits-source-group',
        currentBitGroupMap
      );
    }
  });
};

const clearPointsSourceMap = () => {
  pointsSourceToggleStore.set('points-source', new Map());
  setRewardPointsList(getPointsSourceMap());
};

const clearGroupMap = () => {
  sourceGroupStore.set('source-group', new Map());
};

const clearBitsSourceMap = () => {
  bitsSourceToggleStore.set('bits-source', new Map());
  setBitsPointsList(getBitsSourceMap());
};

const clearBitsGroupMap = () => {
  bitsSourceGroupStore.set('bits-source-group', new Map());
};

/* Setting Scenes */

const setScenesList = () => {
  let firstScene;
  obsScenesElement.innerHTML = '';
  currentScenes.forEach((scene, index) => {
    const optionEl = document.createElement('option');
    optionEl.value = scene.name;
    if (index === 0) {
      optionEl.selected = true;
      firstScene = scene.name;
    }
    const text = document.createTextNode(scene.name);
    // scene also has name of sources
    optionEl.appendChild(text);
    obsScenesElement.appendChild(optionEl);
    scene.sources.forEach((source) => {
      sourcesMap.set(source.name, source);
    });
  });
  setSourceList(firstScene);
};

const setSourceList = (scene) => {
  obsSourcesElement.innerHTML = '';
  const selectOption = document.createElement('option');
  selectOption.selected = true;
  selectOption.value = null;
  selectOption.appendChild(document.createTextNode('(Select a source)'));
  obsSourcesElement.appendChild(selectOption);
  const selectedScene = sceneMap.get(scene);
  const selectedSources = selectedScene.sources;
  selectedSources.forEach((source, index) => {
    const optionEl = document.createElement('option');
    let text;
    if (source.type === 'ffmpeg_source') {
      obs.sendCallback(
        'GetMediaDuration',
        {
          sourceName: source.name,
        },
        (err, res) => {
          if (err) console.error(err);
          const mediaTime = source.name + ` (${res.mediaDuration / 1000}s)`;
          optionEl.value = source.name;
          text = document.createTextNode(mediaTime);
          // scene also has name of sources
          optionEl.appendChild(text);
          optionEl.setAttribute('time', res.mediaDuration / 1000);
          obsSourcesElement.appendChild(optionEl);
        }
      );
    } else {
      optionEl.value = source.name;
      text = document.createTextNode(source.name);
      // scene also has name of sources
      optionEl.appendChild(text);
      obsSourcesElement.appendChild(optionEl);
    }
  });
};

const setBitsScenesList = () => {
  let firstScene;
  obsScenesBitsElement.innerHTML = '';
  bitsCurrentScenes.forEach((scene, index) => {
    const optionEl = document.createElement('option');
    optionEl.value = scene.name;
    if (index === 0) {
      optionEl.selected = true;
      firstScene = scene.name;
    }
    const text = document.createTextNode(scene.name);
    // scene also has name of sources
    optionEl.appendChild(text);
    obsScenesBitsElement.appendChild(optionEl);
    scene.sources.forEach((source) => {
      sourcesMap.set(source.name, source);
    });
  });
  setBitsSourceList(firstScene);
};

const setBitsSourceList = (scene) => {
  obsSourcesBitsElement.innerHTML = '';
  const selectOption = document.createElement('option');
  selectOption.selected = true;
  selectOption.value = null;
  selectOption.appendChild(document.createTextNode('(Select a source)'));
  obsSourcesBitsElement.appendChild(selectOption);
  const selectedScene = sceneMap.get(scene);
  const selectedSources = selectedScene.sources;
  selectedSources.forEach((source, index) => {
    const optionEl = document.createElement('option');
    let text;
    if (source.type === 'ffmpeg_source') {
      obs.sendCallback(
        'GetMediaDuration',
        {
          sourceName: source.name,
        },
        (err, res) => {
          if (err) console.error(err);
          const mediaTime = source.name + ` (${res.mediaDuration / 1000}s)`;
          optionEl.value = source.name;
          text = document.createTextNode(mediaTime);
          // scene also has name of sources
          optionEl.appendChild(text);
          optionEl.setAttribute('time', res.mediaDuration / 1000);
          obsSourcesBitsElement.appendChild(optionEl);
        }
      );
    } else {
      optionEl.value = source.name;
      text = document.createTextNode(source.name);
      // scene also has name of sources
      optionEl.appendChild(text);
      obsSourcesBitsElement.appendChild(optionEl);
    }
  });
};

/** Sets dropdown list for reward points */
const setRewardsList = (rewards) => {
  rewardsElement.innerHTML = '';
  rewards.forEach((reward) => {
    const optionEl = document.createElement('option');
    optionEl.value = reward.title;
    const text = document.createTextNode(`${reward.title} (${reward.cost})`);
    // scene also has name of sources
    optionEl.appendChild(text);
    rewardsElement.appendChild(optionEl);
  });
};

const setRewardPointsList = (rewardPoints) => {
  pointsSourceListEl.innerHTML = `
    <thead>
      <tr>
        <th class="mdl-data-table__cell--non-numeric">Reward</th>
        <th class="mdl-data-table__cell--non-numeric">Scene</th>
        <th class="mdl-data-table__cell--non-numeric">Source</th>
        <th class="data-table-middle">Seconds</th>
        <th class="mdl-data-table__cell--non-numeric">Group</th>
        <th class="mdl-data-table__cell--non-numeric">Random?</th>
        <th width="10px"></th>
        <th width="10px"></th>
        <th width="10px"></th>
      </tr>
    </thead>`;
  const tbodyEl = document.createElement('tbody');
  for (const [key, val] of rewardPoints) {
    const trEl = document.createElement('tr');
    let listItem = `
        <td class="mdl-data-table__cell--non-numeric reward">${key}</td>
        <td class="mdl-data-table__cell--non-numeric">${val.scene}</td>
        <td class="mdl-data-table__cell--non-numeric">${val.source}</td>
        <td class="data-table-middle">${val.time / 1000 === 0 ? 0 : (val.time - 1000) / 1000
      }</td>
        <td class="mdl-data-table__cell--non-numeric">${val.group}</td>
        <td class="mdl-data-table__cell--non-numeric">${val.random ? 'Yes' : 'No'
      }</td>
        <td><i class="material-icons pointer" onclick="testReward(this)">play_arrow</i></td>
        <td><i class="material-icons pointer" onclick="editRow(this)">create</i></td>
        <td><i class="material-icons pointer" onclick="removeRow(this)">delete</i></td>`;
    trEl.innerHTML = listItem;
    tbodyEl.appendChild(trEl);
  }
  // pointsSourceListEl.appendChild(p.childNodes[0]);
  pointsSourceListEl.appendChild(tbodyEl);
  setGroupStoreMapping();
};

const testReward = (row) => {
  const currentReward =
    row.parentNode.parentNode.childNodes[0].nextSibling.innerHTML;
  let currentPointsSourceMap = getPointsSourceMap();
  runToggles(currentPointsSourceMap, currentReward, 'test');
};

const editRow = (row) => {
  const reward = row.parentNode.parentNode.childNodes[0].nextSibling.innerHTML;
  const scene = row.parentNode.parentNode.childNodes[2].nextSibling.innerHTML;
  const source = row.parentNode.parentNode.childNodes[4].nextSibling.innerHTML;
  const time = row.parentNode.parentNode.childNodes[6].nextSibling.innerHTML;
  const group = row.parentNode.parentNode.childNodes[8].nextSibling.innerHTML;
  const random = row.parentNode.parentNode.childNodes[10].nextSibling.innerHTML;
  rewardsElement.value = reward;
  obsScenesElement.value = scene;
  obsScenesElement.selected = true;
  setSourceList(scene);
  // Get new obsSourcesElement
  setTimeout(() => {
    const latestObsSourcesElement = document.getElementById('sources');
    latestObsSourcesElement.value = source;
  }, 100);
  timedElement.value = time;
  groupElement.value = group;
  randomElement.checked = random === 'Yes' ? true : false;
  random === 'Yes'
    ? randomLabelElement.MaterialCheckbox.check()
    : randomLabelElement.MaterialCheckbox.uncheck();
};

const removeRow = (row) => {
  const currentReward =
    row.parentNode.parentNode.childNodes[0].nextSibling.innerHTML;
  removeSingleSourceReward(currentReward);
};

/* End Set Scenes */

const onSceneSelectionChange = () => {
  const selectedSceneValue = obsScenesElement.value;
  setSourceList(selectedSceneValue);
};

const onSourceSelectionChange = () => {
  //When source is selected, set timedElement to value
  const selectedIndex = obsSourcesElement.selectedIndex;
  const selectedOption = obsSourcesElement.options[selectedIndex];
  const timeValue = selectedOption.getAttribute('time');

  if (timeValue) {
    timedElement.value = timeValue;
  } else {
    timedElement.value = 0;
  }
};

// BITS
const setBitsPointsList = (bitSourceData) => {
  bitsSourceListEl.innerHTML = `
    <thead>
      <tr>
        <th class="mdl-data-table__cell--non-numeric">Bits</th>
        <th class="mdl-data-table__cell--non-numeric">Scene</th>
        <th class="mdl-data-table__cell--non-numeric">Source</th>
        <th class="data-table-middle">Seconds</th>
        <th class="mdl-data-table__cell--non-numeric">Group</th>
        <th class="mdl-data-table__cell--non-numeric">Random?</th>
        <th width="10px"></th>
        <th width="10px"></th>
        <th width="10px"></th>
      </tr>
    </thead>`;
  const tbodyEl = document.createElement('tbody');
  for (const [key, val] of bitSourceData) {
    const trEl = document.createElement('tr');
    let listItem = `
        <td class="mdl-data-table__cell--non-numeric reward">${key}</td>
        <td class="mdl-data-table__cell--non-numeric">${val.scene}</td>
        <td class="mdl-data-table__cell--non-numeric">${val.source}</td>
        <td class="data-table-middle">${val.time / 1000 === 0 ? 0 : (val.time - 1000) / 1000
      }</td>
        <td class="mdl-data-table__cell--non-numeric">${val.group}</td>
        <td class="mdl-data-table__cell--non-numeric">${val.random ? 'Yes' : 'No'
      }</td>
        <td><i class="material-icons pointer" onclick="testBits(this)">play_arrow</i></td>
        <td><i class="material-icons pointer" onclick="editBitsRow(this)">create</i></td>
        <td><i class="material-icons pointer" onclick="removeBitsRow(this)">delete</i></td>`;
    trEl.innerHTML = listItem;
    tbodyEl.appendChild(trEl);
  }
  // pointsSourceListEl.appendChild(p.childNodes[0]);
  bitsSourceListEl.appendChild(tbodyEl);
  setBitGroupStoreMapping();
};

// RANDOM WEIGHTED
/**
 * 
 * @param {ObsWebSocket.SceneItem[] | undefined} folderSources 
 */
const setRewardWeightedList = (folderSources) => {
  rewardGroupSettingsListEl.innerHTML = `
  <thead>
    <tr>
      <th>Folder</th>
      <th>Sources</th>
      <th>Percentages</th>
    </tr>
  </thead>
  `;
  const tbodyEl = document.createElement('tbody');
  folderSources.forEach((value, index) => {

    const trEl = document.createElement('tr');
    if (index === 0) {
      let listItem = `
      <th id="folder-name" rowspan="${folderSources.length}" scope="rowgroup">${value.parentGroupName}</th>
      <th scope="row">${value.name}</th>
      <td><input class="mdl-textfield__input text-right full-width" name="randSum[]" type="number" min="0" max="100" id="perc-${index}" value="0" onchange="addRandomSum()"></td>
      `
      trEl.innerHTML = listItem;
    } else {
      let listItem = `
      <th scope="row">${value.name}</th>
      <td><input class="mdl-textfield__input text-right full-width" name="randSum[]" type="number" min="0" max="100" id="perc-${index}" value="0" onchange="addRandomSum()"></td>
      `
      trEl.innerHTML = listItem;
    }
    tbodyEl.appendChild(trEl);
  })
  const percTrEl = document.createElement('tr');
  const percListItem = `
    <td id="total-percentage" colspan="3">
      <div class="text-align" id="random-percent-sum">${randomPercSum}</div>
    </td>
  `
  percTrEl.innerHTML = percListItem;

  tbodyEl.appendChild(percTrEl);

  rewardGroupSettingsListEl.appendChild(tbodyEl);
}

const testBits = (row) => {
  const currentBits =
    row.parentNode.parentNode.childNodes[0].nextSibling.innerHTML;
  let currentBitsSourceMap = getBitsSourceMap();
  runToggles(currentBitsSourceMap, currentBits, 'test');
};

const editBitsRow = (row) => {
  const latestBits =
    row.parentNode.parentNode.childNodes[0].nextSibling.innerHTML;
  const scene = row.parentNode.parentNode.childNodes[2].nextSibling.innerHTML;
  const source = row.parentNode.parentNode.childNodes[4].nextSibling.innerHTML;
  const time = row.parentNode.parentNode.childNodes[6].nextSibling.innerHTML;
  const group = row.parentNode.parentNode.childNodes[8].nextSibling.innerHTML;
  const random = row.parentNode.parentNode.childNodes[10].nextSibling.innerHTML;
  rewardsElement.value = latestBits;
  obsScenesBitsElement.value = scene;
  obsScenesBitsElement.selected = true;
  setBitsSourceList(scene);
  // Get new obsSourcesElement
  setTimeout(() => {
    const latestObsSourcesElement = document.getElementById('bit-sources');
    latestObsSourcesElement.value = source;
  }, 100);
  timedBitsElement.value = time;
  groupBitsElement.value = group;
  randomBitsElement.checked = random === 'Yes' ? true : false;
  random === 'Yes'
    ? randomBitsLabelElement.MaterialCheckbox.check()
    : randomBitsLabelElement.MaterialCheckbox.uncheck();
};

const removeBitsRow = (row) => {
  const currentReward =
    row.parentNode.parentNode.childNodes[0].nextSibling.innerHTML;
  removeSingleBitsSource(currentReward);
};

/* End Set Scenes */

const onBitsSceneSelectionChange = () => {
  const selectedSceneValue = obsScenesBitsElement.value;
  setBitsSourceList(selectedSceneValue);
};

const onBitsSourceSelectionChange = () => {
  //When source is selected, set timedElement to value
  const selectedIndex = obsSourcesBitsElement.selectedIndex;
  const selectedOption = obsSourcesBitsElement.options[selectedIndex];
  const timeValue = selectedOption.getAttribute('time');

  if (timeValue) {
    timedBitsElement.value = timeValue;
  } else {
    timedBitsElement.value = 0;
  }
};

/* OBS Toggling */

const clearPointsTable = () => {
  clearPointsSourceMap();
  clearGroupMap();
};

const clearBitsTable = () => {
  clearBitsSourceMap();
  clearBitsGroupMap();
};

const toggleSpecifiedSource = (source) => {
  const key = source;
  const selectedSource = sourcesMap.get(key);
  let isRendered = selectedSource.render;
  isRendered = !isRendered;
  selectedSource.render = isRendered;
  sourcesMap.set(key, selectedSource);
  toggleSource(source, isRendered);
};

const toggleOffSpecifiedSource = (source) => {
  const selectedSource = sourcesMap.get(source);
  let isRendered = false;
  selectedSource.render = isRendered;
  sourcesMap.set(source, selectedSource);
  toggleSource(source, isRendered);
};

const toggleOnSpecifiedSource = (source) => {
  const key = source;
  const selectedSource = sourcesMap.get(key);
  let isRendered = true;
  selectedSource.render = isRendered;
  sourcesMap.set(key, selectedSource);
  toggleSource(source, isRendered);
};

const toggleSource = (source, toggled) => {
  obs.sendCallback(
    'SetSceneItemRender',
    {
      source: source,
      render: toggled,
    },
    (err, res) => {
      if (err) console.error(err);
    }
  );
};

const timedToggleSource = (source, time) => {
  const key = source;
  const selectedSource = sourcesMap.get(key);
  const currentActiveReward = queueMap.get(source);
  if (currentActiveReward.rewardArray.length > 0) {
    currentActiveReward.flag = true;
    currentActiveReward.rewardArray.shift();
    toggleSource(source, false);
    setTimeout(() => {
      toggleSource(source, true);
      setTimeout(() => {
        toggleSource(source, false);
        if (currentActiveReward.rewardArray.length > 0) {
          timedToggleSource(
            currentActiveReward.reward.source,
            currentActiveReward.reward.time,
            currentActiveReward
          );
        } else {
          currentActiveReward.flag = false;
        }
      }, time);
    }, 500);
    selectedSource.render = false;
    sourcesMap.set(key, selectedSource);
  }
};

const timedToggleRandomSource = (key, chosenMap) => {
  const selectedFolder = chosenMap.get(key);
  if (selectedFolder.rewardArray.length > 0) {
    selectedFolder.flag = true;
    selectedFolder.rewardArray.shift();
    const currentArray = selectedFolder.rewards;
    const currentReward = currentArray[Math.floor(Math.random() * currentArray.length)];
    if (currentReward.type === 'ffmpeg_source') {
      obs.sendCallback(
        'GetMediaDuration',
        {
          sourceName: currentReward.name,
        },
        (err, res) => {
          if (err) console.error(err);
          const mediaTime = res.mediaDuration;
          const currentSourceName = currentReward.name;
          toggleSource(currentSourceName, false);
          setTimeout(() => {
            toggleSource(currentSourceName, true);
            setTimeout(() => {
              toggleSource(currentSourceName, false);
              if (selectedFolder.rewardArray.length > 0) {
                timedToggleRandomSource(key, chosenMap);
              } else {
                selectedFolder.flag = false;
              }
              console.log('timedOut');
            }, mediaTime);
          }, 500);
        }
      );
    } else {
      /* TODO: Get other source types to work */
    }
  }
};

const toggleRandomSources = (folder, user) => {
  obs.send('GetSceneList').then((data) => {
    const scenes = data.scenes;
    const currentScene = scenes.filter((scene) => scene.name === folder.scene);
    const sources = currentScene[0].sources;
    const currentFolder = sources.filter(
      (source) => source.name === folder.source
    )[0];
    const groupedSources = currentFolder.groupChildren;
    checkQueueRandomStatus(folder.source, folder, groupedSources, user);
    // queueRandomMap.set(folder.source, {rewards: groupedSources, flag: false})
  });
};

const getToken = () => {
  shell.openExternal('https://twitchapps.com/tokengen/');
};

const getTwitch = () => {
  shell
    .openExternal(
      'https://id.twitch.tv/oauth2/authorize?client_id=98a3op8i9g48ppw3ji60pw6qlcix52&redirect_uri=http://localhost&response_type=token&scope=chat:read'
    )
    .then((val) => {
      console.log('val', val);
    })
    .catch((err) => {
      console.error(err);
    });
};
