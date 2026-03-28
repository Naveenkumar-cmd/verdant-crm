import usePageTitle from '../hooks/usePageTitle';
// src/pages/Dashboard.js
import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { Spinner, formatCurrency } from '../components/ui/index';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell,
} from 'recharts';
import { Users, UserCircle, Building2, TrendingUp, CheckSquare, Headphones, Plus } from 'lucide-react';
import { Link } from 'react-router-dom';

const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const PIE_COLORS = ['#16a34a','#4ade80','#86efac','#f59e0b','#60a5fa','#a78bfa'];

export default function Dashboard() {
  const { profile, organization } = useAuth();
  usePageTitle('Dashboard');
  const [stats, setStats] = useState(null);
  const [recentDeals, setRecentDeals] = useState([]);
  const [upcomingTasks, setUpcomingTasks] = useState([]);
  const [dealsByStage, setDealsByStage] = useState([]);
  const [monthlyRevenue, setMonthlyRevenue] = useState([]);
  const [loading, setLoading] = useState(true);

  const orgId = profile?.org_id;

  useEffect(() => {
    if (orgId) {
      loadDashboard();
    } else {
      // orgId not yet available (profile still loading) — don't spin forever.
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgId]);

  const loadDashboard = async () => {
    // Wrap each query with a timeout so a hanging RLS/network call can't
    // freeze the spinner forever. 8 seconds is generous; empty results are fine.
    const withTimeout = (promise, fallback = {}) =>
      Promise.race([promise, new Promise(r => setTimeout(() => r(fallback), 8000))]);

    try {
      const [
        { count: leadCount },
        { count: contactCount },
        { count: accountCount },
        { count: dealCount },
        { count: taskCount },
        { count: ticketCount },
        { data: deals },
        { data: tasks },
        { data: stageDeals },
        { data: wonDeals },
      ] = await Promise.all([
        withTimeout(supabase.from('leads').select('*', { count: 'exact', head: true }).eq('org_id', orgId).is('deleted_at', null)),
        withTimeout(supabase.from('contacts').select('*', { count: 'exact', head: true }).eq('org_id', orgId).is('deleted_at', null)),
        withTimeout(supabase.from('accounts').select('*', { count: 'exact', head: true }).eq('org_id', orgId).is('deleted_at', null)),
        withTimeout(supabase.from('deals').select('*', { count: 'exact', head: true }).eq('org_id', orgId).is('deleted_at', null).eq('is_won', false).eq('is_lost', false)),
        withTimeout(supabase.from('tasks').select('*', { count: 'exact', head: true }).eq('org_id', orgId).eq('status', 'not_started')),
        withTimeout(supabase.from('tickets').select('*', { count: 'exact', head: true }).eq('org_id', orgId).eq('status', 'open')),
        withTimeout(supabase.from('deals').select('id,name,amount,stage_name,close_date,accounts(name)').eq('org_id', orgId).is('deleted_at', null).order('created_at', { ascending: false }).limit(5)),
        withTimeout(supabase.from('tasks').select('id,title,due_date,priority,status').eq('org_id', orgId).neq('status', 'completed').not('due_date', 'is', null).order('due_date').limit(5)),
        withTimeout(supabase.from('deals').select('stage_name,amount').eq('org_id', orgId).is('deleted_at', null).eq('is_won', false).eq('is_lost', false)),
        withTimeout(supabase.from('deals').select('amount,close_date').eq('org_id', orgId).eq('is_won', true).is('deleted_at', null)),
      ]);

      setStats({ leadCount, contactCount, accountCount, dealCount, taskCount, ticketCount });
      setRecentDeals(deals || []);
      setUpcomingTasks(tasks || []);

      const stageMap = {};
      (stageDeals || []).forEach(d => {
        if (!stageMap[d.stage_name]) stageMap[d.stage_name] = { name: d.stage_name, value: 0, count: 0 };
        stageMap[d.stage_name].value += d.amount || 0;
        stageMap[d.stage_name].count += 1;
      });
      setDealsByStage(Object.values(stageMap));

      // Build last-6-months revenue from real won deals
      const revenueMap = {};
      const monthLabels = Array.from({ length: 6 }, (_, i) => {
        const d = new Date();
        d.setMonth(d.getMonth() - (5 - i));
        return { key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2,'0')}`, label: MONTH_NAMES[d.getMonth()] };
      });
      monthLabels.forEach(m => { revenueMap[m.key] = 0; });
      (wonDeals || []).forEach(d => {
        if (!d.close_date) return;
        const key = d.close_date.slice(0, 7);
        if (key in revenueMap) revenueMap[key] += d.amount || 0;
      });
      setMonthlyRevenue(monthLabels.map(m => ({ month: m.label, revenue: revenueMap[m.key] })));
    } catch (err) {
      console.error('Dashboard error:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className="page-container"><Spinner /></div>;

  const greeting = () => {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 17) return 'Good afternoon';
    return 'Good evening';
  };

  const STAT_CARDS = [
    { label: 'Active Leads',  value: stats?.leadCount ?? 0,    icon: Users,      path: '/leads',    color: '#dbeafe',              iconColor: '#1d4ed8' },
    { label: 'Contacts',      value: stats?.contactCount ?? 0, icon: UserCircle, path: '/contacts', color: 'var(--green-100)',     iconColor: 'var(--green-700)' },
    { label: 'Accounts',      value: stats?.accountCount ?? 0, icon: Building2,  path: '/accounts', color: '#fef3c7',              iconColor: '#b45309' },
    { label: 'Open Deals',    value: stats?.dealCount ?? 0,    icon: TrendingUp, path: '/deals',    color: '#ede9fe',              iconColor: '#6d28d9' },
    { label: 'Pending Tasks', value: stats?.taskCount ?? 0,    icon: CheckSquare,path: '/tasks',    color: '#fce7f3',              iconColor: '#be185d' },
    { label: 'Open Tickets',  value: stats?.ticketCount ?? 0,  icon: Headphones, path: '/tickets',  color: '#fee2e2',              iconColor: '#b91c1c' },
  ];

  return (
    <div className="page-container">
      {/* Greeting */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(20px, 4vw, 26px)', fontWeight: 700 }}>
          {greeting()}, {profile?.first_name || 'there'} 👋
        </h1>
        <p style={{ color: 'var(--gray-500)', marginTop: 4, fontSize: 14 }}>
          Here's what's happening at {organization?.name || 'your workspace'} today.
        </p>
      </div>

      {/* Stat Cards — responsive grid */}
      <div className="stats-grid">
        {STAT_CARDS.map(s => (
          <Link key={s.label} to={s.path} style={{ textDecoration: 'none' }}>
            <div className="stat-card" style={{ cursor: 'pointer', transition: 'transform 0.15s, box-shadow 0.15s' }}
              onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = 'var(--shadow-lg)'; }}
              onMouseLeave={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = ''; }}>
              <div className="stat-icon" style={{ background: s.color }}>
                <s.icon size={20} color={s.iconColor} />
              </div>
              <div className="stat-value">{s.value.toLocaleString()}</div>
              <div className="stat-label">{s.label}</div>
            </div>
          </Link>
        ))}
      </div>

      {/* Charts row — collapses to single column on tablet/mobile */}
      <div className="charts-grid">
        {/* Revenue chart */}
        <div className="card">
          <div className="card-header">
            <h3 style={{ fontSize: 15 }}>Revenue Trend</h3>
            <span style={{ fontSize: 12, color: 'var(--gray-400)' }}>Last 6 months</span>
          </div>
          <div style={{ padding: '16px 8px 8px' }}>
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={monthlyRevenue}>
                <defs>
                  <linearGradient id="greenGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#16a34a" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="#16a34a" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false}
                  tickFormatter={v => `$${(v / 1000).toFixed(0)}k`} width={40} />
                <Tooltip formatter={v => [formatCurrency(v), 'Revenue']} />
                <Area type="monotone" dataKey="revenue" stroke="#16a34a" strokeWidth={2.5}
                  fill="url(#greenGrad)" dot={{ fill: '#16a34a', strokeWidth: 0, r: 3 }} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Pipeline pie */}
        <div className="card">
          <div className="card-header">
            <h3 style={{ fontSize: 15 }}>Pipeline by Stage</h3>
          </div>
          <div style={{ padding: '16px 8px 8px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            {dealsByStage.length > 0 ? (
              <>
                <ResponsiveContainer width="100%" height={140}>
                  <PieChart>
                    <Pie data={dealsByStage} dataKey="value" nameKey="name"
                      cx="50%" cy="50%" innerRadius={38} outerRadius={60}>
                      {dealsByStage.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                    </Pie>
                    <Tooltip formatter={v => formatCurrency(v)} />
                  </PieChart>
                </ResponsiveContainer>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 5, width: '100%', marginTop: 8 }}>
                  {dealsByStage.slice(0, 4).map((s, i) => (
                    <div key={s.name} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
                      <div style={{ width: 8, height: 8, borderRadius: 2, background: PIE_COLORS[i % PIE_COLORS.length], flexShrink: 0 }} />
                      <span style={{ flex: 1, color: 'var(--gray-600)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.name}</span>
                      <span style={{ fontWeight: 600, color: 'var(--gray-800)' }}>{s.count}</span>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div style={{ color: 'var(--gray-400)', fontSize: 13, padding: '30px 0' }}>No pipeline data yet</div>
            )}
          </div>
        </div>
      </div>

      {/* Bottom row — collapses on mobile */}
      <div className="bottom-grid">
        {/* Recent Deals */}
        <div className="card">
          <div className="card-header">
            <h3 style={{ fontSize: 15 }}>Recent Deals</h3>
            <Link to="/deals" className="btn btn-ghost btn-sm" style={{ fontSize: 12 }}>View all</Link>
          </div>
          {recentDeals.length === 0 ? (
            <div className="empty-state" style={{ padding: '30px 0' }}>
              <p style={{ fontSize: 13 }}>No deals yet</p>
              <Link to="/deals" className="btn btn-primary btn-sm" style={{ marginTop: 10 }}>
                <Plus size={14} /> Add Deal
              </Link>
            </div>
          ) : (
            recentDeals.map(deal => (
              <div key={deal.id} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '12px 20px', borderBottom: '1px solid var(--color-border)',
                gap: 12,
              }}>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--gray-800)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {deal.name}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--gray-500)', marginTop: 2 }}>
                    {deal.accounts?.name || '—'} · {deal.stage_name || '—'}
                  </div>
                </div>
                <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--green-700)', flexShrink: 0 }}>
                  {formatCurrency(deal.amount)}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Upcoming Tasks */}
        <div className="card">
          <div className="card-header">
            <h3 style={{ fontSize: 15 }}>Upcoming Tasks</h3>
            <Link to="/tasks" className="btn btn-ghost btn-sm" style={{ fontSize: 12 }}>View all</Link>
          </div>
          {upcomingTasks.length === 0 ? (
            <div className="empty-state" style={{ padding: '30px 0' }}>
              <p style={{ fontSize: 13 }}>No upcoming tasks</p>
              <Link to="/tasks" className="btn btn-primary btn-sm" style={{ marginTop: 10 }}>
                <Plus size={14} /> Add Task
              </Link>
            </div>
          ) : (
            upcomingTasks.map(task => (
              <div key={task.id} style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '12px 20px', borderBottom: '1px solid var(--color-border)',
              }}>
                <div style={{
                  width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
                  background: task.priority === 'urgent' ? 'var(--red-500)'
                    : task.priority === 'high' ? '#f59e0b' : 'var(--green-500)',
                }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {task.title}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--gray-400)', marginTop: 2 }}>
                    Due: {new Date(task.due_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </div>
                </div>
                <span style={{
                  fontSize: 11, fontWeight: 600, padding: '2px 7px', borderRadius: 100,
                  textTransform: 'capitalize', flexShrink: 0,
                  background: task.priority === 'urgent' ? '#fee2e2' : task.priority === 'high' ? '#fef3c7' : 'var(--green-100)',
                  color: task.priority === 'urgent' ? 'var(--red-500)' : task.priority === 'high' ? '#b45309' : 'var(--green-700)',
                }}>
                  {task.priority}
                </span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
