export type DashboardStructuredAlertDomain = "ADAS" | "DMS";
export type DashboardAlertNameMapping = {
  title: string;
  domain?: DashboardStructuredAlertDomain;
  code?: number;
};

export const DASHBOARD_SIGNAL_CODE_MAP: Record<string, DashboardAlertNameMapping> = {
  platform_video_alarm_0101: { title: "Video Signal Lost", code: 0x0101 },
  platform_video_alarm_0102: { title: "Video Signal Occlusion", code: 0x0102 },
  platform_video_alarm_0103: { title: "Storage Failure", code: 0x0103 },
  platform_video_alarm_0104: { title: "Other Video Equipment Failure", code: 0x0104 },
  platform_video_alarm_0105: { title: "Passenger Overload", code: 0x0105 },
  platform_video_alarm_0106: { title: "Abnormal Driving Behavior", code: 0x0106 },
  platform_video_alarm_0107: { title: "Special Alarm Recording Threshold", code: 0x0107 },
  jtt1078_storage_failure: { title: "Storage Failure", code: 0x0103 },
};

export const DASHBOARD_STRUCTURED_ALERT_TITLE_MAP: Record<DashboardStructuredAlertDomain, Record<number, string>> = {
  ADAS: {
    1: "ADAS: Forward Collision Alert",
    2: "ADAS: Lane Departure Alert",
    3: "ADAS: Too Close Distance Alert",
    4: "ADAS: Pedestrian Collision Alert",
    5: "ADAS: Frequent Lane Change Alert",
    6: "ADAS: Road Sign Exceedance Alert",
    7: "ADAS: Obstacle Alert",
    16: "ADAS: Road Sign Recognition Event",
    17: "ADAS: Active Snapshot Event",
  },
  DMS: {
    1: "DMS: Fatigue Driving Alert",
    2: "DMS: Calling Alert",
    3: "DMS: Smoking Alert",
    4: "DMS: Distracted Driving Alert",
    5: "DMS: Driver Abnormality Alert",
    6: "DMS: Steering Wheel Alert",
    7: "DMS: Infrared Blocking",
    8: "DMS: Seat Belt Alert",
    10: "DMS: Device Blocking",
    13: "DMS: Play Phone",
    16: "DMS: Automatic Snapshot Event",
    17: "DMS: Driver Change Event",
  },
};

export const DASHBOARD_OFFICIAL_ALERT_ALIAS_MAP: Record<string, DashboardAlertNameMapping> = {
  "adas: forward collision alert": { title: "ADAS: Forward Collision Alert", domain: "ADAS", code: 1 },
  "adas: lane departure alert": { title: "ADAS: Lane Departure Alert", domain: "ADAS", code: 2 },
  "adas: too close distance alert": { title: "ADAS: Too Close Distance Alert", domain: "ADAS", code: 3 },
  "adas: pedestrian collision alert": { title: "ADAS: Pedestrian Collision Alert", domain: "ADAS", code: 4 },
  "adas: frequent lane change alert": { title: "ADAS: Frequent Lane Change Alert", domain: "ADAS", code: 5 },
  "adas: road sign exceedance alert": { title: "ADAS: Road Sign Exceedance Alert", domain: "ADAS", code: 6 },
  "adas: obstruction alarm": { title: "ADAS: Obstacle Alert", domain: "ADAS", code: 7 },
  "adas: road sign identification event": { title: "ADAS: Road Sign Recognition Event", domain: "ADAS", code: 16 },
  "adas: active capture event": { title: "ADAS: Active Snapshot Event", domain: "ADAS", code: 17 },
  "dms: fatigue driving alert": { title: "DMS: Fatigue Driving Alert", domain: "DMS", code: 1 },
  "dms: fatigue driving alarm": { title: "DMS: Fatigue Driving Alert", domain: "DMS", code: 1 },
  "dms: calling alert": { title: "DMS: Calling Alert", domain: "DMS", code: 2 },
  "dms: handheld phone alarm": { title: "DMS: Calling Alert", domain: "DMS", code: 2 },
  "dms: smoking alert": { title: "DMS: Smoking Alert", domain: "DMS", code: 3 },
  "dms: smoking alarm": { title: "DMS: Smoking Alert", domain: "DMS", code: 3 },
  "dms: distracted driving alert": { title: "DMS: Distracted Driving Alert", domain: "DMS", code: 4 },
  "dms: driver abnormal alarm": { title: "DMS: Driver Abnormality Alert", domain: "DMS", code: 5 },
  "dms: steering wheel alert": { title: "DMS: Steering Wheel Alert", domain: "DMS", code: 6 },
  "dms: infrared blocking": { title: "DMS: Infrared Blocking", domain: "DMS", code: 7 },
  "dms: seat belt alert": { title: "DMS: Seat Belt Alert", domain: "DMS", code: 8 },
  "dms: device blocking": { title: "DMS: Device Blocking", domain: "DMS", code: 10 },
  "dms: play phone": { title: "DMS: Play Phone", domain: "DMS", code: 13 },
  "dms: automatic capture event": { title: "DMS: Automatic Snapshot Event", domain: "DMS", code: 16 },
  "dms: driver change event": { title: "DMS: Driver Change Event", domain: "DMS", code: 17 },
  "storage failure": { title: "Storage Failure", code: 0x0103 },
  "video signal lost": { title: "Video Signal Lost", code: 0x0101 },
  "video signal occlusion": { title: "Video Signal Occlusion", code: 0x0102 },
  "other video equipment failure": { title: "Other Video Equipment Failure", code: 0x0104 },
  "passenger overload": { title: "Passenger Overload", code: 0x0105 },
  "special alarm recording threshold": { title: "Special Alarm Recording Threshold", code: 0x0107 },
};
