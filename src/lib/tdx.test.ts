import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import axios from 'axios'
import type { tdx as TdxApi } from './tdx'

vi.mock('axios', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn()
  }
}))

const mockedGet = vi.mocked(axios.get)
const mockedPost = vi.mocked(axios.post)

function tokenResponse(expiresIn = 3600) {
  return { data: { access_token: 'fake-token', expires_in: expiresIn } }
}

function envelope(listKey: string, items: unknown[], headers: Record<string, string> = {}) {
  return { data: { [listKey]: items }, headers }
}

async function loadTdx(): Promise<typeof TdxApi> {
  vi.resetModules()
  const mod = await import('./tdx')
  return mod.tdx
}

describe('tdx', () => {
  beforeEach(() => {
    mockedGet.mockReset()
    mockedPost.mockReset()
    mockedPost.mockResolvedValue(tokenResponse())
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('getStationTimetable', () => {
    it('flattens groups and injects Direction from each group', async () => {
      const tdx = await loadTdx()
      mockedGet.mockResolvedValue(
        envelope('StationTimetables', [
          {
            StationID: '1000',
            Direction: 0,
            TimeTables: [
              { TrainNo: '101', ArrivalTime: '08:00', DepartureTime: '08:02' },
              { TrainNo: '103', ArrivalTime: '09:00', DepartureTime: '09:02' }
            ]
          },
          {
            StationID: '1000',
            Direction: 1,
            TimeTables: [{ TrainNo: '202', ArrivalTime: '08:30', DepartureTime: '08:32' }]
          }
        ])
      )

      const result = await tdx.getStationTimetable('1000')

      expect(result).toHaveLength(3)
      expect(result[0]).toMatchObject({ TrainNo: '101', Direction: 0 })
      expect(result[1]).toMatchObject({ TrainNo: '103', Direction: 0 })
      expect(result[2]).toMatchObject({ TrainNo: '202', Direction: 1 })
    })

    it("uses group Direction even if entry already has one (group wins)", async () => {
      const tdx = await loadTdx()
      mockedGet.mockResolvedValue(
        envelope('StationTimetables', [
          {
            Direction: 1,
            TimeTables: [
              { TrainNo: '999', Direction: 0, ArrivalTime: '', DepartureTime: '' }
            ]
          }
        ])
      )

      const result = await tdx.getStationTimetable('1000')
      expect(result[0]?.Direction).toBe(1)
    })

    it('returns [] for empty groups', async () => {
      const tdx = await loadTdx()
      mockedGet.mockResolvedValue(envelope('StationTimetables', []))
      expect(await tdx.getStationTimetable('1000')).toEqual([])
    })
  })

  describe('getToken caching', () => {
    it('only requests token once across multiple calls', async () => {
      const tdx = await loadTdx()
      mockedGet.mockResolvedValue(envelope('Stations', []))

      await tdx.getStations()
      await tdx.getStations()
      await tdx.getStations()

      expect(mockedPost).toHaveBeenCalledTimes(1)
    })

    it('reuses token before the 60s safety margin', async () => {
      const tdx = await loadTdx()
      mockedPost.mockResolvedValue(tokenResponse(100))
      mockedGet.mockResolvedValue(envelope('Stations', []))

      await tdx.getStations()
      vi.advanceTimersByTime(39_000) // 39s < (100 - 60)
      await tdx.getStations()

      expect(mockedPost).toHaveBeenCalledTimes(1)
    })

    it('refreshes token after passing the safety margin', async () => {
      const tdx = await loadTdx()
      mockedPost.mockResolvedValue(tokenResponse(100))
      mockedGet.mockResolvedValue(envelope('Stations', []))

      await tdx.getStations()
      vi.advanceTimersByTime(41_000) // 41s > (100 - 60)
      await tdx.getStations()

      expect(mockedPost).toHaveBeenCalledTimes(2)
    })

    it('sends Bearer token in request headers', async () => {
      const tdx = await loadTdx()
      mockedGet.mockResolvedValue(envelope('Stations', []))

      await tdx.getStations()

      expect(mockedGet).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: { Authorization: 'Bearer fake-token' }
        })
      )
    })
  })

  describe('unwrap envelope fallbacks', () => {
    it('returns [] when expected listKey is missing', async () => {
      const tdx = await loadTdx()
      mockedGet.mockResolvedValue({ data: {}, headers: {} })
      expect(await tdx.getStations()).toEqual([])
    })

    it('returns [] when response data is null', async () => {
      const tdx = await loadTdx()
      mockedGet.mockResolvedValue({ data: null, headers: {} })
      expect(await tdx.getStations()).toEqual([])
    })
  })

  describe('getLiveTrains $filter', () => {
    it("builds OData $filter when stationId is provided", async () => {
      const tdx = await loadTdx()
      mockedGet.mockResolvedValue(envelope('TrainLiveBoards', []))

      await tdx.getLiveTrains('1020')

      expect(mockedGet).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          params: {
            $top: 200,
            $filter: "StationID eq '1020'",
            $format: 'JSON'
          }
        })
      )
    })

    it('omits $filter when no stationId is given', async () => {
      const tdx = await loadTdx()
      mockedGet.mockResolvedValue(envelope('TrainLiveBoards', []))

      await tdx.getLiveTrains()

      const call = mockedGet.mock.calls[0]!
      expect(call[1]?.params).toEqual({ $top: 200, $format: 'JSON' })
    })
  })

  describe('sunset/deprecation header', () => {
    it('warns only once per endpoint even after repeated calls', async () => {
      const tdx = await loadTdx()
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
      mockedGet.mockResolvedValue(
        envelope('Stations', [], { sunset: 'Sun, 31 Dec 2025 23:59:59 GMT' })
      )

      await tdx.getStations()
      await tdx.getStations()
      await tdx.getStations()

      expect(warn).toHaveBeenCalledTimes(1)
      warn.mockRestore()
    })

    it('warns separately for different endpoints', async () => {
      const tdx = await loadTdx()
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
      mockedGet
        .mockResolvedValueOnce(envelope('Stations', [], { sunset: 'a' }))
        .mockResolvedValueOnce(envelope('TrainLiveBoards', [], { sunset: 'b' }))

      await tdx.getStations()
      await tdx.getLiveTrains()

      expect(warn).toHaveBeenCalledTimes(2)
      warn.mockRestore()
    })

    it('does not warn when no sunset header is present', async () => {
      const tdx = await loadTdx()
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
      mockedGet.mockResolvedValue(envelope('Stations', []))

      await tdx.getStations()

      expect(warn).not.toHaveBeenCalled()
      warn.mockRestore()
    })
  })

  describe('URL composition', () => {
    it('builds OD timetable URL with from/to/date suffix', async () => {
      const tdx = await loadTdx()
      mockedGet.mockResolvedValue(envelope('TrainTimetables', []))

      await tdx.getTimeTable('1000', '1020', '2026-05-26')

      expect(mockedGet).toHaveBeenCalledWith(
        'https://tdx.transportdata.tw/api/basic/v3/Rail/TRA/DailyTrainTimetable/OD/1000/to/1020/2026-05-26',
        expect.anything()
      )
    })

    it('builds station timetable URL with station suffix', async () => {
      const tdx = await loadTdx()
      mockedGet.mockResolvedValue(envelope('StationTimetables', []))

      await tdx.getStationTimetable('1020')

      expect(mockedGet).toHaveBeenCalledWith(
        'https://tdx.transportdata.tw/api/basic/v3/Rail/TRA/DailyStationTimetable/Today/Station/1020',
        expect.anything()
      )
    })

    it('builds ODFare URL with from/to suffix', async () => {
      const tdx = await loadTdx()
      mockedGet.mockResolvedValue(envelope('ODFares', []))

      await tdx.getFare('1000', '1020')

      expect(mockedGet).toHaveBeenCalledWith(
        'https://tdx.transportdata.tw/api/basic/v3/Rail/TRA/ODFare/1000/to/1020',
        expect.anything()
      )
    })

    it('always appends $format=JSON to params', async () => {
      const tdx = await loadTdx()
      mockedGet.mockResolvedValue(envelope('Stations', []))

      await tdx.getStations()

      const call = mockedGet.mock.calls[0]!
      expect(call[1]?.params).toMatchObject({ $format: 'JSON' })
    })
  })
})
