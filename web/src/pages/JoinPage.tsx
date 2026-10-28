import { useEffect, useRef, useState } from 'react'
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'
import { useJoinGroupMutation } from '@/api/kanakkuApi'
import { errorMessage } from '@/api/baseQuery'
import { useAppSelector } from '@/store'
import { Button } from '@/components/ui/Button'
import { Wordmark } from '@/components/layout/AppShell'

/** /join/CODE — the link people share. Signed-in users join immediately; others sign in first and come back. */
export function JoinPage() {
  const { code = '' } = useParams()
  const user = useAppSelector((s) => s.auth.user)
  const navigate = useNavigate()
  const [join] = useJoinGroupMutation()
  const [error, setError] = useState('')
  const started = useRef(false)

  useEffect(() => {
    if (!user || started.current) return
    started.current = true
    join({ inviteCode: code })
      .unwrap()
      .then((g) => navigate(`/groups/${g.id}`, { replace: true }))
      .catch((e) => setError(errorMessage(e)))
  }, [user, code, join, navigate])

  if (!user) return <Navigate to="/login" replace state={{ from: `/join/${code}` }} />

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="card p-6 w-full max-w-sm text-center">
        <div className="flex justify-center mb-4">
          <Wordmark />
        </div>
        {error ? (
          <>
            <p className="font-semibold">Couldn't join</p>
            <p className="text-[13px] text-muted mt-1">{error}</p>
            <Link to="/groups" className="inline-block mt-4">
              <Button variant="secondary">Go to groups</Button>
            </Link>
          </>
        ) : (
          <p className="text-[14px] text-muted">
            Joining with code <span className="money font-medium text-ink">{code}</span>…
          </p>
        )}
      </div>
    </div>
  )
}
