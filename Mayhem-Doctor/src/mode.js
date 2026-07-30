export const Mode = {
  OFFICIAL: 'official',
  CLASSIC: 'classic'
};

const MODE_CONFIG = {
  [Mode.OFFICIAL]: {
    queueId: 2400,
    storePrefix: '',
    filePrefix: '',
    label: 'Official Mayhem',
    shortLabel: 'Official',
    cacheStoreModule: 'mayhemDoctorCache',
    globalStoreModule: 'mayhemDoctorGlobal',
    patchFilterStoreModule: 'mayhemDoctorPatchFilter',
    globalStatsFile: './data/md-global-stats.json',
    globalStatsFileName: 'md-global-stats.json',
  },
  [Mode.CLASSIC]: {
    queueId: 2450,
    storePrefix: 'Classic',
    filePrefix: 'classic-',
    label: 'Mayhem: Classic',
    shortLabel: 'Classic',
    cacheStoreModule: 'mayhemDoctorClassicCache',
    globalStoreModule: 'mayhemDoctorClassicGlobal',
    patchFilterStoreModule: 'mayhemDoctorClassicPatchFilter',
    globalStatsFile: './data/classic-md-global-stats.json',
    globalStatsFileName: 'classic-md-global-stats.json',
  }
};

export function getModeConfig(mode) {
  return MODE_CONFIG[mode] || MODE_CONFIG[Mode.OFFICIAL];
}

export function getQueueId(mode) {
  return getModeConfig(mode).queueId;
}

export function getValidQueueIds(mode) {
  return [getQueueId(mode)];
}

export function getCacheStoreModule(mode) {
  return getModeConfig(mode).cacheStoreModule;
}

export function getGlobalStoreModule(mode) {
  return getModeConfig(mode).globalStoreModule;
}

export function getPatchFilterStoreModule(mode) {
  return getModeConfig(mode).patchFilterStoreModule;
}

export function getGlobalStatsFile(mode) {
  return getModeConfig(mode).globalStatsFile;
}

export function getGlobalStatsFileName(mode) {
  return getModeConfig(mode).globalStatsFileName;
}

export function getModeLabel(mode) {
  return getModeConfig(mode).label;
}

export function getShortLabel(mode) {
  return getModeConfig(mode).shortLabel;
}
