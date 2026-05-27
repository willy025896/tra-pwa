import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { tdx as TdxApi } from './tdx'

function jsonResponse(data: unknown, headers: Record<string, string> = {}): Promise<Response> {
  return Promise.resolve({
    ok: true,
    json: () => Promise.resolve(data),
    headers: { get: (k: string) => headers[k.toLowerCase()] ?? null }
  } as unknown as Response)
}

function tokenResponse(expiresIn = 3600) {
  return jsonResponse({ access_token: 'fake-token', expires_in: expiresIn })
}

function envelope(listKey: string, items: unknown[], headers: Record<string, string> = {}) {
  return jsonResponse({ [listKey]: items }, headers)
}

async function loadTdx(): Promise<typeof TdxApi> {
  vi.resetModules()
  const mod = await import('./tdx')
  return mod.tdx
}

describe('tdx', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let fetchMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    fetchMock = vi.fn((_url: unknown, init?: RequestInit) => {
      if (init?.method === 'POST') return tokenResponse()
      return jsonResponse({})
    })
    vi.stubGlobal('fetch', fetchMock)
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.useRealTimers()
  })

  describe('getStationTimetable', () => {
    it('flattens groups and injects Direction from each group', async () => {
      const tdx = await loadTdx()
      fetchMock.mockImplementation((_url: unknown, init?: RequestInit) => {
        if (init?.method === 'POST') return tokenResponse()
        return envelope('StationTimetables', [
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
      })

      const result = await tdx.getStationTimetable('1000')

      expect(result).toHaveLength(3)
      expect(result[0]).toMatchObject({ TrainNo: '101', Direction: 0 })
      expect(result[1]).toMatchObject({ TrainNo: '103', Direction: 0 })
      expect(result[2]).toMatchObject({ TrainNo: '202', Direction: 1 })
    })

    it("uses group Direction even if entry already has one (group wins)", async () => {
      const tdx = await loadTdx()
      fetchMock.mockImplementation((_url: unknown, init?: RequestInit) => {
        if (init?.method === 'POST') return tokenResponse()
        return envelope('StationTimetables', [
          {
            Direction: 1,
            TimeTables: [
              { TrainNo: '999', Direction: 0, ArrivalTime: '', DepartureTime: '' }
            ]
          }
        ])
      })

      const result = await tdx.getStationTimetable('1000')
      expect(result[0]?.Direction).toBe(1)
    })

    it('returns [] for empty groups', async () => {
      const tdx = await loadTdx()
      fetchMock.mockImplementation((_url: unknown, init?: RequestInit) => {
        if (init?.method === 'POST') return tokenResponse()
        return envelope('StationTimetables', [])
      })
      expect(await tdx.getStationTimetable('1000')).toEqual([])
    })
  })

  describe('getToken caching', () => {
    it('only requests token once across multiple calls', async () => {
      const tdx = await loadTdx()
      fetchMock.mockImplementation((_url: unknown, init?: RequestInit) => {
        if (init?.method === 'POST') return tokenResponse()
        return envelope('Stations', [])
      })

      await tdx.getStations()
      await tdx.getStations()
      await tdx.getStations()

      const postCalls = fetchMock.mock.calls.filter(([, init]: [unknown, RequestInit?]) => init?.method === 'POST')
      expect(postCalls).toHaveLength(1)
    })

    it('reuses token before the 60s safety margin', async () => {
      const tdx = await loadTdx()
      fetchMock.mockImplementation((_url: unknown, init?: RequestInit) => {
        if (init?.method === 'POST') return tokenResponse(100)
        return envelope('Stations', [])
      })

      await tdx.getStations()
      vi.advanceTimersByTime(39_000) // 39s < (100 - 60)
      await tdx.getStations()

      const postCalls = fetchMock.mock.calls.filter(([, init]: [unknown, RequestInit?]) => init?.method === 'POST')
      expect(postCalls).toHaveLength(1)
    })

    it('refreshes token after passing the safety margin', async () => {
      const tdx = await loadTdx()
      fetchMock.mockImplementation((_url: unknown, init?: RequestInit) => {
        if (init?.method === 'POST') return tokenResponse(100)
        return envelope('Stations', [])
      })

      await tdx.getStations()
      vi.advanceTimersByTime(41_000) // 41s > (100 - 60)
      await tdx.getStations()

      const postCalls = fetchMock.mock.calls.filter(([, init]: [unknown, RequestInit?]) => init?.method === 'POST')
      expect(postCalls).toHaveLength(2)
    })

    it('sends Bearer token in request headers', async () => {
      const tdx = await loadTdx()
      fetchMock.mockImplementation((_url: unknown, init?: RequestInit) => {
        if (init?.method === 'POST') return tokenResponse()
        return envelope('Stations', [])
      })

      await tdx.getStations()

      const getCalls = fetchMock.mock.calls.filter(([, init]: [unknown, RequestInit?]) => init?.method !== 'POST')
      expect(getCalls[0][1]).toMatchObject({
        headers: { Authorization: 'Bearer fake-token' }
      })
    })
  })

  describe('unwrap envelope fallbacks', () => {
    it('returns [] when expected listKey is missing', async () => {
      const tdx = await loadTdx()
      fetchMock.mockImplementation((_url: unknown, init?: RequestInit) => {
        if (init?.method === 'POST') return tokenResponse()
        return jsonResponse({})
      })
      expect(await tdx.getStations()).toEqual([])
    })

    it('returns [] when response data is null', async () => {
      const tdx = await loadTdx()
      fetchMock.mockImplementation((_url: unknown, init?: RequestInit) => {
        if (init?.method === 'POST') return tokenResponse()
        return jsonResponse(null)
      })
      expect(await tdx.getStations()).toEqual([])
    })
  })

  describe('getLiveTrains $filter', () => {
    it("builds OData $filter when stationId is provided", async () => {
      const tdx = await loadTdx()
      fetchMock.mockImplementation((_url: unknown, init?: RequestInit) => {
        if (init?.method === 'POST') return tokenResponse()
        return envelope('TrainLiveBoards', [])
      })

      await tdx.getLiveTrains('1020')

      const getCalls = fetchMock.mock.calls.filter(([, init]: [unknown, RequestInit?]) => init?.method !== 'POST')
      const url = new URL(getCalls[0][0] as string)
      expect(Object.fromEntries(url.searchParams)).toMatchObject({
        $top: '200',
        $filter: "StationID eq '1020'",
        $format: 'JSON'
      })
    })

    it('omits $filter when no stationId is given', async () => {
      const tdx = await loadTdx()
      fetchMock.mockImplementation((_url: unknown, init?: RequestInit) => {
        if (init?.method === 'POST') return tokenResponse()
        return envelope('TrainLiveBoards', [])
      })

      await tdx.getLiveTrains()

      const getCalls = fetchMock.mock.calls.filter(([, init]: [unknown, RequestInit?]) => init?.method !== 'POST')
      const url = new URL(getCalls[0][0] as string)
      const params = Object.fromEntries(url.searchParams)
      expect(params).toEqual({ $top: '200', $format: 'JSON' })
    })
  })

  describe('sunset/deprecation header', () => {
    it('warns only once per endpoint even after repeated calls', async () => {
      const tdx = await loadTdx()
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
      fetchMock.mockImplementation((_url: unknown, init?: RequestInit) => {
        if (init?.method === 'POST') return tokenResponse()
        return envelope('Stations', [], { sunset: 'Sun, 31 Dec 2025 23:59:59 GMT' })
      })

      await tdx.getStations()
      await tdx.getStations()
      await tdx.getStations()

      expect(warn).toHaveBeenCalledTimes(1)
      warn.mockRestore()
    })

    it('warns separately for different endpoints', async () => {
      const tdx = await loadTdx()
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
      fetchMock.mockImplementation((_url: unknown, init?: RequestInit) => {
        if (init?.method === 'POST') return tokenResponse()
        return jsonResponse({})  // overridden per-call below
      })
      fetchMock
        .mockImplementationOnce((_url: unknown, init?: RequestInit) => {
          if (init?.method === 'POST') return tokenResponse()
          return jsonResponse({}) // token call — won't match
        })
        .mockImplementationOnce((_url: unknown) =>
          envelope('Stations', [], { sunset: 'a' })
        )
        .mockImplementationOnce((_url: unknown) =>
          envelope('TrainLiveBoards', [], { sunset: 'b' })
        )

      await tdx.getStations()
      await tdx.getLiveTrains()

      expect(warn).toHaveBeenCalledTimes(2)
      warn.mockRestore()
    })

    it('does not warn when no sunset header is present', async () => {
      const tdx = await loadTdx()
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
      fetchMock.mockImplementation((_url: unknown, init?: RequestInit) => {
        if (init?.method === 'POST') return tokenResponse()
        return envelope('Stations', [])
      })

      await tdx.getStations()

      expect(warn).not.toHaveBeenCalled()
      warn.mockRestore()
    })
  })

  describe('URL composition', () => {
    it('builds OD timetable URL with from/to/date suffix', async () => {
      const tdx = await loadTdx()
      fetchMock.mockImplementation((_url: unknown, init?: RequestInit) => {
        if (init?.method === 'POST') return tokenResponse()
        return envelope('TrainTimetables', [])
      })

      await tdx.getTimeTable('1000', '1020', '2026-05-26')

      const getCalls = fetchMock.mock.calls.filter(([, init]: [unknown, RequestInit?]) => init?.method !== 'POST')
      const url = new URL(getCalls[0][0] as string)
      expect(url.origin + url.pathname).toBe(
        'https://tdx.transportdata.tw/api/basic/v3/Rail/TRA/DailyTrainTimetable/OD/1000/to/1020/2026-05-26'
      )
    })

    it('builds station timetable URL with station suffix', async () => {
      const tdx = await loadTdx()
      fetchMock.mockImplementation((_url: unknown, init?: RequestInit) => {
        if (init?.method === 'POST') return tokenResponse()
        return envelope('StationTimetables', [])
      })

      await tdx.getStationTimetable('1020')

      const getCalls = fetchMock.mock.calls.filter(([, init]: [unknown, RequestInit?]) => init?.method !== 'POST')
      const url = new URL(getCalls[0][0] as string)
      expect(url.origin + url.pathname).toBe(
        'https://tdx.transportdata.tw/api/basic/v3/Rail/TRA/DailyStationTimetable/Today/Station/1020'
      )
    })

    it('builds ODFare URL with from/to suffix', async () => {
      const tdx = await loadTdx()
      fetchMock.mockImplementation((_url: unknown, init?: RequestInit) => {
        if (init?.method === 'POST') return tokenResponse()
        return envelope('ODFares', [])
      })

      await tdx.getFare('1000', '1020')

      const getCalls = fetchMock.mock.calls.filter(([, init]: [unknown, RequestInit?]) => init?.method !== 'POST')
      const url = new URL(getCalls[0][0] as string)
      expect(url.origin + url.pathname).toBe(
        'https://tdx.transportdata.tw/api/basic/v3/Rail/TRA/ODFare/1000/to/1020'
      )
    })

    it('always appends $format=JSON to params', async () => {
      const tdx = await loadTdx()
      fetchMock.mockImplementation((_url: unknown, init?: RequestInit) => {
        if (init?.method === 'POST') return tokenResponse()
        return envelope('Stations', [])
      })

      await tdx.getStations()

      const getCalls = fetchMock.mock.calls.filter(([, init]: [unknown, RequestInit?]) => init?.method !== 'POST')
      const url = new URL(getCalls[0][0] as string)
      expect(url.searchParams.get('$format')).toBe('JSON')
    })
  })
})
