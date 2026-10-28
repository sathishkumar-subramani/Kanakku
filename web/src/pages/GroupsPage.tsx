import { useState } from 'react'
import { Link } from 'react-router-dom'
import { KeyRound, Plus, Users } from 'lucide-react'
import { useGroupsQuery } from '@/api/kanakkuApi'
import { useAppSelector } from '@/store'
import { moneyCompact } from '@/utils/money'
import { Button } from '@/components/ui/Button'
import { AvatarStack, BalanceText, EmptyState, Skeleton } from '@/components/ui/Bits'
import { GroupForm, JoinGroupForm } from '@/components/groups/GroupForms'

export function GroupsPage() {
  const { data: groups, isLoading } = useGroupsQuery()
  const user = useAppSelector((s) => s.auth.user)
  const [creating, setCreating] = useState(false)
  const [joining, setJoining] = useState(false)

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-[26px] font-bold">Groups</h1>
        <div className="flex gap-2">
          <Button variant="secondary" icon={<KeyRound size={16} />} onClick={() => setJoining(true)}>
            Join with code
          </Button>
          <Button icon={<Plus size={16} />} onClick={() => setCreating(true)}>
            New group
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="grid sm:grid-cols-2 gap-3">
          {[0, 1].map((i) => (
            <Skeleton key={i} className="h-[120px]" />
          ))}
        </div>
      ) : !groups || groups.length === 0 ? (
        <div className="card">
          <EmptyState
            icon={<Users size={30} />}
            title="No groups yet"
            body="Create one for your room, then share the invite code with your roommates. Or join a group someone already made."
            action={
              <div className="flex gap-2">
                <Button variant="secondary" onClick={() => setJoining(true)}>
                  Join with code
                </Button>
                <Button onClick={() => setCreating(true)}>Create a group</Button>
              </div>
            }
          />
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 gap-3">
          {groups.map((g) => (
            <Link key={g.id} to={`/groups/${g.id}`} className="card p-5 hover:border-accent transition rise block">
              <div className="flex items-start gap-3">
                <span className="w-12 h-12 rounded-card flex items-center justify-center text-[24px] shrink-0" style={{ background: g.color + '26' }}>
                  {g.emoji}
                </span>
                <div className="flex-1 min-w-0">
                  <h2 className="font-bold text-[16px] truncate">{g.name}</h2>
                  <p className="text-[12px] text-muted">
                    {g.members.length} {g.members.length === 1 ? 'member' : 'members'} · {moneyCompact(g.monthSpent, g.currency)} this month
                  </p>
                </div>
                <AvatarStack people={g.members.map((m) => ({ name: m.userId === user?.id ? 'You' : m.name, avatarColor: m.avatarColor }))} size={26} max={4} />
              </div>
              <div className="mt-4 flex items-center justify-between">
                <BalanceText balance={g.myBalance} currency={g.currency} className="text-[14px]" />
                <span className="text-[12px] text-muted">{moneyCompact(g.totalSpent, g.currency)} total</span>
              </div>
            </Link>
          ))}
        </div>
      )}

      <GroupForm open={creating} onClose={() => setCreating(false)} />
      <JoinGroupForm open={joining} onClose={() => setJoining(false)} />
    </div>
  )
}
