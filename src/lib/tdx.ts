import axios from 'axios'

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
  const res = await axios.post(
    'https://tdx.transportdata.tw/auth/realms/TDXConnect/protocol/openid-connect/token',
    new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET
    }),
    { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
  )
  _token = res.data.access_token
  _tokenExpiry = Date.now() + (res.data.expires_in - 60) * 1000
  return _token
}

async function tdxGet<T>(
  key: EndpointKey,
  suffix = '',
  params: Record<string, unknown> = {}
): Promise<T> {
  const token = await getToken()
  const { version, path } = ENDPOINTS[key]
  const url = `${TDX_BASE}/${version}${path}${suffix}`
  const res = await axios.get(url, {
    headers: { Authorization: `Bearer ${token}` },
    params: { ...params, $format: 'JSON' }
  })
  const sunset = res.headers['sunset'] || res.headers['deprecation']
  if (sunset && !warnedSunset.has(key)) {
    warnedSunset.add(key)
    console.warn(`[TDX] endpoint "${key}" (${version}) is deprecated: ${sunset}`)
  }
  return res.data
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

export const TRAIN_STATION_STATUS_NAME: Record<number, string> = {
  0: '進站中',
  1: '在站上',
  2: '已離站',
  3: '已過站',
  4: '通過'
}

export const DIRECTION_NAME: Record<number, string> = {
  0: '南下',
  1: '北上'
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

export const FARE_CLASS_NAME: Record<number, string> = {
  1: '全票',
  2: '來回票',
  3: '孩童票',
  4: '敬老票',
  5: '愛心票',
  6: '愛心陪伴票',
  7: '團體票'
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
