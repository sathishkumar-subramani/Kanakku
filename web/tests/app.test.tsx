import { beforeEach, describe, expect, it } from 'vitest'
import { render, screen, waitFor, within, cleanup } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import App from '@/App'
import { kanakkuApi } from '@/api/kanakkuApi'
import { setSession, signOut } from '@/api/session'
import { store } from '@/store'
import { db, flags, seed } from './fakeApi'

let seeded: ReturnType<typeof seed>

function signInAs(user: { id: string; name: string; email: string; avatarColor: string; currency: string; createdAt: string }) {
  // mimic a completed login
  const accessToken = 'at-test'
  const refreshToken = 'rt-test'
  db.tokens.set(accessToken, user.id)
  db.refresh.set(refreshToken, user.id)
  setSession({ accessToken, refreshToken, user: { id: user.id, name: user.name, email: user.email, avatarColor: user.avatarColor, currency: user.currency, createdAt: user.createdAt } })
}

function go(path: string) {
  window.history.pushState({}, '', path)
}

beforeEach(() => {
  cleanup()
  signOut()
  store.dispatch(kanakkuApi.util.resetApiState())
  seeded = seed()
  go('/')
})

describe('auth', () => {
  it('redirects to login, signs in and shows the dashboard', async () => {
    const user = userEvent.setup()
    render(<App />)
    expect(await screen.findByRole('heading', { name: 'Welcome back' })).toBeInTheDocument()

    await user.type(screen.getByLabelText('Email'), 'sathish@example.com')
    await user.type(screen.getByLabelText('Password'), 'wrong')
    await user.click(screen.getByRole('button', { name: 'Sign in' }))
    expect(await screen.findByText('Email or password is incorrect.')).toBeInTheDocument()

    await user.clear(screen.getByLabelText('Password'))
    await user.type(screen.getByLabelText('Password'), 'secret1')
    await user.click(screen.getByRole('button', { name: 'Sign in' }))

    // dashboard: my cost = 500 + 300 + 200 (group shares) + 120 (coffee) = 1,120; I'm owed 500 overall
    expect(await screen.findByText('Sathish')).toBeInTheDocument()
    expect((await screen.findAllByText('₹1,120')).length).toBeGreaterThan(0)
    expect(screen.getByText('₹500')).toBeInTheDocument()
    expect(screen.getAllByText('Room 302').length).toBeGreaterThan(0)
    expect(screen.getByText('you are owed ₹500.00')).toBeInTheDocument()
    // recent list shows both group and personal lines
    expect(screen.getByText('Coffee')).toBeInTheDocument()
    expect(screen.getByText('Groceries')).toBeInTheDocument()
  })

  it('creates an account', async () => {
    const user = userEvent.setup()
    go('/register')
    render(<App />)
    await user.type(await screen.findByLabelText('Your name'), 'New Person')
    await user.type(screen.getByLabelText('Email'), 'new@example.com')
    await user.type(screen.getByLabelText(/^Password/), 'secret1')
    await user.click(screen.getByRole('button', { name: 'Create account' }))
    expect(await screen.findByText('New')).toBeInTheDocument()
    expect(await screen.findByText(/not in any group yet/)).toBeInTheDocument()
  })

  it('refreshes an expired access token transparently', async () => {
    signInAs(seeded.me)
    flags.expireAccessOnce = true
    render(<App />)
    expect((await screen.findAllByText('₹1,120')).length).toBeGreaterThan(0)
    expect(db.calls.some((c) => c.path === '/auth/refresh')).toBe(true)
  })
})

describe('groups', () => {
  it('shows expenses, balances and records a payment', async () => {
    const user = userEvent.setup()
    signInAs(seeded.me)
    go(`/groups/${seeded.group.id}`)
    render(<App />)

    expect(await screen.findByRole('heading', { name: 'Room 302' })).toBeInTheDocument()
    expect(await screen.findByText('Groceries')).toBeInTheDocument()
    expect(screen.getByText('Electricity bill')).toBeInTheDocument()
    expect(screen.getByText('Dinner')).toBeInTheDocument()

    // balances tab: Priya owes me 500 and Arun 100 (simplified)
    await user.click(screen.getByRole('button', { name: 'Balances' }))
    const whoPays = (await screen.findByRole('heading', { name: 'Who pays whom' })).closest('section')!
    expect(await within(whoPays).findByText('₹500.00')).toBeInTheDocument()
    expect(within(whoPays).getByText('₹100.00')).toBeInTheDocument()

    // settle the first debt via its Settle button → prefilled sheet
    await user.click(within(whoPays).getAllByRole('button', { name: 'Settle' })[0])
    expect(await screen.findByRole('heading', { name: 'Record a payment' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Record payment' }))
    expect(await screen.findByText('Priya paid You — recorded')).toBeInTheDocument()
    await waitFor(() => expect(db.settlements.length).toBe(1))
    expect(db.settlements[0]).toMatchObject({ fromUserId: seeded.priya.id, toUserId: seeded.me.id, amount: 500 })

    // after settling, only Arun's 100 remains
    await waitFor(() => expect(within(whoPays).queryByText('₹500.00')).not.toBeInTheDocument())
    expect(screen.getAllByLabelText('Delete payment')).toHaveLength(1)
  })

  it('adds an expense with an exact split and shows the live remainder', async () => {
    const user = userEvent.setup()
    signInAs(seeded.me)
    go(`/groups/${seeded.group.id}`)
    render(<App />)
    await screen.findByText('Groceries')

    await user.click(within(screen.getByRole('main')).getByRole('button', { name: 'Add expense' }))
    const dialog = await screen.findByRole('dialog', { name: 'Add expense' })
    await user.type(within(dialog).getByPlaceholderText('0'), '300')
    await user.type(within(dialog).getByLabelText('What was it for?'), 'Auto to station')
    expect(within(dialog).getByText('₹100.00 each · 3 people')).toBeInTheDocument()

    // advanced → exact; defaults to 100 each → valid
    await user.click(within(dialog).getByLabelText('Advanced split'))
    expect(await within(dialog).findByText('Adds up — nice.')).toBeInTheDocument()
    const inputs = within(dialog).getAllByRole('spinbutton')
    await user.clear(inputs[0])
    await user.type(inputs[0], '150')
    expect(within(dialog).getByText('50.00 over the total')).toBeInTheDocument()
    await user.clear(inputs[1])
    await user.type(inputs[1], '50')
    expect(within(dialog).getByText('Adds up — nice.')).toBeInTheDocument()

    await user.click(within(dialog).getByRole('button', { name: 'Add expense' }))
    expect(await screen.findByText('Expense added')).toBeInTheDocument()
    expect(await screen.findByText('Auto to station')).toBeInTheDocument()
    const saved = db.expenses.find((e) => e.description === 'Auto to station')!
    expect(saved.splitType).toBe('exact')
    expect(saved.splits.map((s) => s.amount)).toEqual([150, 50, 100])
  })

  it('opens an expense, edits it and deletes it', async () => {
    const user = userEvent.setup()
    signInAs(seeded.me)
    go(`/groups/${seeded.group.id}`)
    render(<App />)
    await user.click(await screen.findByText('Dinner'))
    expect(await screen.findByText('Split by exact')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Edit' }))
    const dialog = await screen.findByRole('dialog', { name: 'Edit expense' })
    const desc = within(dialog).getByLabelText('What was it for?')
    await user.clear(desc)
    await user.type(desc, 'Dinner at Saravana')
    await user.click(within(dialog).getByRole('button', { name: 'Save changes' }))
    expect(await screen.findByText('Dinner at Saravana')).toBeInTheDocument()

    await user.click(screen.getByText('Dinner at Saravana'))
    await user.click(await screen.findByRole('button', { name: 'Delete' }))
    const confirm = await screen.findByRole('dialog', { name: 'Delete this expense?' })
    await user.click(within(confirm).getByRole('button', { name: 'Delete' }))
    await waitFor(() => expect(db.expenses.some((e) => e.description === 'Dinner at Saravana')).toBe(false))
  })

  it('members tab: invite code, add by email, leave blocked while unsettled', async () => {
    const user = userEvent.setup()
    signInAs(seeded.me)
    go(`/groups/${seeded.group.id}?tab=members`)
    render(<App />)
    expect(await screen.findByText('ROOM3022')).toBeInTheDocument()

    await user.type(screen.getByPlaceholderText('friend@example.com'), 'nobody@example.com')
    await user.click(screen.getByRole('button', { name: 'Add' }))
    expect(await screen.findByText(/No Kanakku account with that email/)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Leave' }))
    const confirm = await screen.findByRole('dialog', { name: 'Leave this group?' })
    await user.click(within(confirm).getByRole('button', { name: 'Leave' }))
    expect(await screen.findByText(/Settle up first/)).toBeInTheDocument()
  })

  it('creates a group and joins one with a code', async () => {
    const user = userEvent.setup()
    signInAs(seeded.arun)
    go('/groups')
    render(<App />)
    await user.click(await screen.findByRole('button', { name: 'New group' }))
    await user.type(await screen.findByLabelText('Name'), 'Goa trip')
    await user.click(screen.getByRole('button', { name: 'Create group' }))
    expect(await screen.findByRole('heading', { name: 'Goa trip' })).toBeInTheDocument()
    expect(window.location.search).toContain('tab=members')
  })
})

describe('personal, reports, settings', () => {
  it('adds and deletes a personal expense', async () => {
    const user = userEvent.setup()
    signInAs(seeded.me)
    go('/personal')
    render(<App />)
    expect(await screen.findByText('Coffee')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Add' }))
    const dialog = await screen.findByRole('dialog', { name: 'Add personal expense' })
    await user.type(within(dialog).getByPlaceholderText('0'), '80')
    await user.type(within(dialog).getByLabelText('What was it for?'), 'Bus pass')
    await user.click(within(dialog).getByRole('button', { name: 'Add expense' }))
    expect(await screen.findByText('Bus pass')).toBeInTheDocument()
    expect(screen.getAllByText('₹200').length).toBeGreaterThan(0)
  })

  it('downloads a PDF report for a scope', async () => {
    const user = userEvent.setup()
    signInAs(seeded.me)
    go('/reports')
    render(<App />)
    await user.click(await screen.findByRole('button', { name: /Personal only/ }))
    await user.click(screen.getByRole('button', { name: 'Download PDF' }))
    expect(await screen.findByText('PDF downloaded')).toBeInTheDocument()
    const call = db.calls.find((c) => c.path === '/reports/monthly')!
    expect(call).toBeTruthy()
  })

  it('saves profile changes and changes the password', async () => {
    const user = userEvent.setup()
    signInAs(seeded.me)
    go('/settings')
    render(<App />)
    const name = await screen.findByLabelText('Name')
    await user.clear(name)
    await user.type(name, 'Sathish K')
    await user.click(screen.getByRole('button', { name: 'Save' }))
    expect(await screen.findByText('Profile saved')).toBeInTheDocument()
    expect(db.users[0].name).toBe('Sathish K')

    await user.type(screen.getByLabelText('Current password'), 'nope')
    await user.type(screen.getByLabelText('New password'), 'secret2')
    await user.type(screen.getByLabelText('Repeat new password'), 'secret2')
    await user.click(screen.getByRole('button', { name: 'Update password' }))
    expect(await screen.findByText('Current password is incorrect.')).toBeInTheDocument()
  })
})
