const TDX_BASE = 'https://tdx.transportdata.tw/api/basic'
const CLIENT_ID = import.meta.env.VITE_TDX_CLIENT_ID as string
const CLIENT_SECRET = import.meta.env.VITE_TDX_CLIENT_SECRET as string

const ENDPOINTS = {
  station:          { version: 'v3', path: '/Rail/TRA/Station',                         listKey: 'Stations' },
  timetable:        { version: 'v3', path: '/Rail/TRA/DailyTrainTimetable/OD',          listKey: 'TrainTimetables' },
  liveBoard:        { version: 'v3', path: '/Rail/TRA/TrainLiveBoard',                  listKey: 'TrainLiveBoards' },
  stationTimetable: { version: 'v3', path: '/Rail/TRA/DailyStationTimetable/Today/Station', listKey: 'StationTimetables' },
  odFare:           { version: 'v3', path: '/Rail/TRA/ODFare',                          listKey: 'ODFares' }
} as const

type EndpointKey = keyof typeof ENDPOINTS
const warnedSunset = new Set<string>()

let _token = ''
let _tokenExpiry = 0

async function getToken(): Promise<string> {
  if (_token && Date.now() < _tokenExpiry) return _token
  const res = await fetch(
    'https://tdx.transportdata.tw/auth/realms/TDXConnect/protocol/openid-connect/token',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET
      })
    }
  )
  if (!res.ok) throw new Error(`TDX auth error: ${res.status}`)
  const data = await res.json()
  _token = data.access_token
  _tokenExpiry = Date.now() + (data.expires_in - 60) * 1000
  return _token
}

async function tdxGet<T>(
  key: EndpointKey,
  suffix = '',
  params: Record<string, unknown> = {}
): Promise<T> {
  const token = await getToken()
  const { version, path } = ENDPOINTS[key]
  const qs = new URLSearchParams(
    Object.entries({ ...params, $format: 'JSON' }).map(([k, v]) => [k, String(v)])
  )
  const url = `${TDX_BASE}/${version}${path}${suffix}?${qs}`
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` }
  })
  if (!res.ok) throw new Error(`TDX error: ${res.status}`)
  const sunset = res.headers.get('sunset') || res.headers.get('deprecation')
  if (sunset && !warnedSunset.has(key)) {
    warnedSunset.add(key)
    console.warn(`[TDX] endpoint "${key}" (${version}) is deprecated: ${sunset}`)
  }
  return res.json()
}

function unwrap<T>(key: EndpointKey, data: Record<string, unknown>): T[] {
  return (data?.[ENDPOINTS[key].listKey] as T[]) ?? []
}

export interface Station {
  StationID: string
  StationName: { Zh_tw: string; En: string }
  StationPosition?: { PositionLat: number; PositionLon: number }
}

export interface StopTime {
  StopSequence?: number
  StationID: string
  StationName: { Zh_tw: string; En?: string }
  ArrivalTime: string
  DepartureTime: string
  SuspendedFlag?: number
}

export interface TrainInfo {
  TrainNo: string
  Direction?: number
  TrainTypeID?: string
  TrainTypeCode?: string
  TrainTypeName: { Zh_tw: string; En?: string }
  TripHeadSign?: string
  StartingStationID?: string
  StartingStationName: { Zh_tw: string; En?: string }
  EndingStationID?: string
  EndingStationName: { Zh_tw: string; En?: string }
  OverNightStationID?: string
  Note?: string
}

export interface TrainTime {
  TrainInfo: TrainInfo
  StopTimes: StopTime[]
}

export interface LiveTrain {
  TrainNo: string
  TrainTypeID?: string
  TrainTypeCode?: string
  TrainTypeName: { Zh_tw: string; En?: string }
  StationID: string
  StationName: { Zh_tw: string; En?: string }
  TrainStationStatus?: number
  DelayTime: number
  UpdateTime: string
}

export const TRAIN_STATION_STATUS = {
  APPROACHING: 0,
  AT_STATION: 1,
  LEAVING: 2,
  PASSED: 3,
  PASSING: 4
} as const

export const TRAIN_STATION_STATUS_NAME: Record<number, string> = {
  [TRAIN_STATION_STATUS.APPROACHING]: '進站中',
  [TRAIN_STATION_STATUS.AT_STATION]:  '在站上',
  [TRAIN_STATION_STATUS.LEAVING]:     '已離站',
  [TRAIN_STATION_STATUS.PASSED]:      '已過站',
  [TRAIN_STATION_STATUS.PASSING]:     '通過'
}

export const DIRECTION = {
  SOUTHBOUND: 0,
  NORTHBOUND: 1
} as const

export const DIRECTION_NAME: Record<number, string> = {
  [DIRECTION.SOUTHBOUND]: '南下',
  [DIRECTION.NORTHBOUND]: '北上'
}

export interface StationTimetableEntry {
  Sequence?: number
  TrainNo: string
  Direction: number
  TrainTypeID?: string
  TrainTypeCode?: string
  TrainTypeName?: { Zh_tw: string; En?: string }
  DestinationStationID?: string
  DestinationStationName?: { Zh_tw: string; En?: string }
  ArrivalTime: string
  DepartureTime: string
  SuspendedFlag?: number
}

export interface StationTimetable {
  RouteID?: string
  StationID: string
  StationName: { Zh_tw: string; En?: string }
  Direction: number
  TimeTables: Omit<StationTimetableEntry, 'Direction'>[]
}

export interface FareDetail {
  TicketType: number
  FareClass: number
  CabinClass: number
  Price: number
}

export interface ODFare {
  OriginStationID: string
  OriginStationName: { Zh_tw: string; En: string }
  DestinationStationID: string
  DestinationStationName: { Zh_tw: string; En: string }
  Direction: number
  TrainType: number
  Fares: FareDetail[]
  TravelDistance?: number
}

export const TRAIN_TYPE_NAME: Record<number, string> = {
  1: '太魯閣',
  2: '普悠瑪',
  3: '自強',
  4: '莒光',
  5: '復興',
  6: '區間',
  7: '普快',
  10: '區間快',
  11: '新自強 (EMU3000)'
}

export const FARE_CLASS = {
  FULL: 1,
  ROUND_TRIP: 2,
  CHILD: 3,
  SENIOR: 4,
  DISABILITY: 5,
  COMPANION: 6,
  GROUP: 7
} as const

export const FARE_CLASS_NAME: Record<number, string> = {
  [FARE_CLASS.FULL]:       '全票',
  [FARE_CLASS.ROUND_TRIP]: '來回票',
  [FARE_CLASS.CHILD]:      '孩童票',
  [FARE_CLASS.SENIOR]:     '敬老票',
  [FARE_CLASS.DISABILITY]: '愛心票',
  [FARE_CLASS.COMPANION]:  '愛心陪伴票',
  [FARE_CLASS.GROUP]:      '團體票'
}

export const tdx = {
  async getStations(): Promise<Station[]> {
    const data = await tdxGet<Record<string, unknown>>('station')
    return unwrap<Station>('station', data)
  },

  async getTimeTable(fromId: string, toId: string, date: string): Promise<TrainTime[]> {
    const data = await tdxGet<Record<string, unknown>>('timetable', `/${fromId}/to/${toId}/${date}`)
    return unwrap<TrainTime>('timetable', data)
  },

  async getLiveTrains(stationId?: string): Promise<LiveTrain[]> {
    const params: Record<string, unknown> = { $top: 200 }
    if (stationId) params.$filter = `StationID eq '${stationId}'`
    const data = await tdxGet<Record<string, unknown>>('liveBoard', '', params)
    return unwrap<LiveTrain>('liveBoard', data)
  },

  async getStationTimetable(stationId: string): Promise<StationTimetableEntry[]> {
    const data = await tdxGet<Record<string, unknown>>('stationTimetable', `/${stationId}`)
    const groups = unwrap<StationTimetable>('stationTimetable', data)
    return groups.flatMap(g =>
      g.TimeTables.map(e => ({ ...e, Direction: g.Direction }))
    )
  },

  async getFare(fromId: string, toId: string): Promise<ODFare[]> {
    const data = await tdxGet<Record<string, unknown>>('odFare', `/${fromId}/to/${toId}`)
    return unwrap<ODFare>('odFare', data)
  }
}
