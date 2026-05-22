import axios from 'axios'

const TDX_BASE = 'https://tdx.transportdata.tw/api/basic'
const CLIENT_ID = import.meta.env.VITE_TDX_CLIENT_ID as string
const CLIENT_SECRET = import.meta.env.VITE_TDX_CLIENT_SECRET as string

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

async function tdxGet<T>(path: string, params: Record<string, unknown> = {}): Promise<T> {
  const token = await getToken()
  const res = await axios.get(`${TDX_BASE}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
    params: { ...params, $format: 'JSON' }
  })
  return res.data
}

export interface Station {
  StationID: string
  StationName: { Zh_tw: string; En: string }
  StationPosition?: { PositionLat: number; PositionLon: number }
}

export interface StopTime {
  StationID: string
  StationName: { Zh_tw: string }
  ArrivalTime: string
  DepartureTime: string
}

export interface TrainTime {
  TrainNo: string
  TrainTypeName: { Zh_tw: string }
  StartingStationName: { Zh_tw: string }
  EndingStationName: { Zh_tw: string }
  OriginStopTime: { DepartureTime: string }
  DestinationStopTime: { ArrivalTime: string }
  StopTimes: StopTime[]
  OverNightStation?: string
}

export interface LiveTrain {
  TrainNo: string
  TrainTypeName: { Zh_tw: string }
  DelayTime: number
  TrainDate: string
  StationID: string
  StationName: { Zh_tw: string }
  UpdateTime: string
}

export interface FareDetail {
  FareClass: string
  TicketType: string
  Price: number
}

export interface ODFare {
  OriginStationID: string
  OriginStationName: { Zh_tw: string }
  DestinationStationID: string
  DestinationStationName: { Zh_tw: string }
  Fares: FareDetail[]
}

export const tdx = {
  async getStations(): Promise<Station[]> {
    const data = await tdxGet<Station[]>('/v2/Rail/TRA/Station')
    return data
  },

  async getTimeTable(fromId: string, toId: string, date: string): Promise<TrainTime[]> {
    const data = await tdxGet<{ TrainTimetables: TrainTime[] }>(
      `/v2/Rail/TRA/DailyTrainTimetable/OD/${fromId}/to/${toId}/${date}`
    )
    return data.TrainTimetables ?? []
  },

  async getLiveTrains(stationId?: string): Promise<LiveTrain[]> {
    const params: Record<string, unknown> = { $top: 200 }
    if (stationId) params.$filter = `StationID eq '${stationId}'`
    return tdxGet<LiveTrain[]>('/v2/Rail/TRA/TrainLiveBoard', params)
  },

  async getFare(fromId: string, toId: string): Promise<ODFare | null> {
    const data = await tdxGet<ODFare[]>(`/v2/Rail/TRA/ODFare/${fromId}/to/${toId}`)
    return data?.[0] ?? null
  }
}
