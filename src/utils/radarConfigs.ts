/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Imports all AWR6843 chirp config files from src/assets/config_file/
 * using Vite's ?raw import. Each file is bundled as a plain string
 * so no file-system access is needed at runtime on Android.
 */

import fixedConfig              from '../assets/config_file/fixed_config.cfg?raw';
import nexonEv                  from '../assets/config_file/nexon_ev.cfg?raw';
import nexonEvFrontMount        from '../assets/config_file/nexon_ev_front_mount.cfg?raw';
import nexonEvRearviewMount     from '../assets/config_file/nexon_ev_rearview_mount.cfg?raw';
import redefinedConfig          from '../assets/config_file/redefined_config.cfg?raw';
import vod6843AopOverhead2row   from '../assets/config_file/vod_6843_aop_overhead_2row.cfg?raw';
import vod6843AopOverhead2rowClass from '../assets/config_file/vod_6843_aop_overhead_2row_classification.cfg?raw';
import vod6843AopOverhead2rowIntruder from '../assets/config_file/vod_6843_aop_overhead_2row_intruder.cfg?raw';
import vod6843AopOverhead2rowVan from '../assets/config_file/vod_6843_aop_overhead_2row_van.cfg?raw';
import vod6843AopOverhead3rowBus from '../assets/config_file/vod_6843_aop_overhead_3row_bus.cfg?raw';
import vod6843IskFrontMount2row from '../assets/config_file/vod_6843_isk_frontMount_2row.cfg?raw';
import vod6843IskFrontMount2rowTest from '../assets/config_file/vod_6843_isk_frontMount_2row_test.cfg?raw';
import vod6843OdsOverheadMount2rowTest from '../assets/config_file/vod_6843_ods_overheadMount_2row_test .cfg?raw';
import vod6843OdsOverhead2row   from '../assets/config_file/vod_6843_ods_overhead_2row.cfg?raw';
import vod6843OdsOverhead2rowClass from '../assets/config_file/vod_6843_ods_overhead_2row_classification.cfg?raw';
import vod6843OdsOverhead3rowOpt from '../assets/config_file/vod_6843_ods_overhead_3row_optimized.cfg?raw';
import cabinDefault             from '../assets/awr6843_cabin.cfg?raw';

export interface RadarConfigEntry {
  id: string;
  label: string;
  description: string;
  raw: string;
}

/** All available radar chirp configurations */
export const RADAR_CONFIGS: RadarConfigEntry[] = [
  {
    id: 'nexon_ev',
    label: 'Nexon EV (2-Row, AOP)',
    description: 'Tata Nexon EV — overhead AOP mount, 2-row cabin, 5 zones',
    raw: nexonEv,
  },
  {
    id: 'nexon_ev_front',
    label: 'Nexon EV — Front Mount',
    description: 'Nexon EV with front dashboard mount configuration',
    raw: nexonEvFrontMount,
  },
  {
    id: 'nexon_ev_rear',
    label: 'Nexon EV — Rearview Mount',
    description: 'Nexon EV with rearview mirror / windshield mount',
    raw: nexonEvRearviewMount,
  },
  {
    id: 'vod_aop_2row',
    label: 'VOD — AOP Overhead 2-Row',
    description: 'Vehicle Occupancy Detection, AOP overhead mount, 2 rows',
    raw: vod6843AopOverhead2row,
  },
  {
    id: 'vod_aop_2row_class',
    label: 'VOD — AOP Overhead 2-Row (Classification)',
    description: 'AOP overhead 2-row with adult/child classification',
    raw: vod6843AopOverhead2rowClass,
  },
  {
    id: 'vod_aop_2row_intruder',
    label: 'VOD — AOP Overhead Intruder',
    description: 'AOP 2-row with intruder / hot child detection mode',
    raw: vod6843AopOverhead2rowIntruder,
  },
  {
    id: 'vod_aop_2row_van',
    label: 'VOD — AOP Overhead 2-Row (Van)',
    description: 'AOP overhead optimised for van / MPV wheelbase',
    raw: vod6843AopOverhead2rowVan,
  },
  {
    id: 'vod_aop_3row_bus',
    label: 'VOD — AOP Overhead 3-Row (Bus)',
    description: 'AOP 3-row configuration for minibus / shuttle',
    raw: vod6843AopOverhead3rowBus,
  },
  {
    id: 'vod_isk_front_2row',
    label: 'VOD — ISK Front Mount 2-Row',
    description: 'ISK sensor front-mounted, 2-row sedan / SUV',
    raw: vod6843IskFrontMount2row,
  },
  {
    id: 'vod_isk_front_2row_test',
    label: 'VOD — ISK Front Mount 2-Row (Test)',
    description: 'ISK front mount test/debug configuration',
    raw: vod6843IskFrontMount2rowTest,
  },
  {
    id: 'vod_ods_overhead_2row',
    label: 'VOD — ODS Overhead 2-Row',
    description: 'ODS sensor overhead mount, 2-row cabin',
    raw: vod6843OdsOverhead2row,
  },
  {
    id: 'vod_ods_overhead_2row_class',
    label: 'VOD — ODS Overhead 2-Row (Classification)',
    description: 'ODS overhead 2-row with classification enabled',
    raw: vod6843OdsOverhead2rowClass,
  },
  {
    id: 'vod_ods_overhead_2row_test',
    label: 'VOD — ODS Overhead 2-Row (Test)',
    description: 'ODS overhead mount test/debug configuration',
    raw: vod6843OdsOverheadMount2rowTest,
  },
  {
    id: 'vod_ods_3row_opt',
    label: 'VOD — ODS Overhead 3-Row (Optimised)',
    description: 'ODS overhead optimised 3-row for large SUV / crossover',
    raw: vod6843OdsOverhead3rowOpt,
  },
  {
    id: 'fixed_config',
    label: 'Fixed Config (Generic)',
    description: 'Generic fixed configuration for bench testing',
    raw: fixedConfig,
  },
  {
    id: 'redefined',
    label: 'Redefined Config',
    description: 'Redefined / custom tuned configuration',
    raw: redefinedConfig,
  },
  {
    id: 'cabin_default',
    label: 'Cabin Default (Built-in)',
    description: 'CabinIQ built-in short-range cabin profile (10fps, 0.1–4m)',
    raw: cabinDefault,
  },
];

/** Returns the first config as default */
export const DEFAULT_CONFIG_ID = RADAR_CONFIGS[0].id;

/** Look up a config entry by id */
export function getConfigById(id: string): RadarConfigEntry {
  return RADAR_CONFIGS.find(c => c.id === id) ?? RADAR_CONFIGS[0];
}

/**
 * Strip comment lines (starting with %) and blank lines.
 * Returns only the lines the radar firmware will accept.
 */
export function cleanConfigText(raw: string): string {
  return raw
    .split('\n')
    .map(l => l.trim())
    .filter(l => l.length > 0 && !l.startsWith('%'))
    .join('\n');
}
