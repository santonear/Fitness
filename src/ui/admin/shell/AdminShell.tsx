import { BudgetDismissButton } from '../todos/BudgetDismissButton';
import { StatusOverview } from '../finance/StatusOverview';
import { useEffect, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { adminRequest, reverifyAdmin } from '../shared/api';
import { AdminDialog, AdminToast } from '../shared/components';
import type { AdminTodo } from '../../../backend/admin/core/contracts';
import { ApplicationsPage, UsersPage, AuditPage, ReviewTemplates } from '../users/UsersPages';
import { FinanceLedger, FinanceSettings, FinanceCosts } from '../finance/FinancePages';
import { AdminQualityPage, AdminErrorsPage, AdminNotificationSettings } from '../quality/pages';
import { ReleasesPage } from '../releases/ReleasesPage';
import { PromptVersionsPage } from '../releases/PromptVersionsPage';
import { FeedbackPage } from '../feedback/FeedbackPage';
import { adminWorkspaceTokens } from '../tokens';
import { AdminIcon, type AdminIconName } from './AdminIcon';
import './admin-shell.css';

type Entry = readonly [id: string, zh: string, en: string, icon: AdminIconName];
const entries: readonly Entry[] = [
  ['todo', '待办', 'To do', 'home'],
  ['applications', '申请', 'Applications', 'inbox'],
  ['users', '用户', 'Users', 'users'],
  ['feedback', '留言', 'Messages', 'message'],
  ['ledger', '用量', 'Usage', 'chart'],
  ['coach', '芽芽', 'Yaya', 'sprout'],
  ['releases', '开关与发布', 'Flags & releases', 'toggle'],
  ['errors', '错误', 'Errors', 'alert'],
  ['settings', '设置', 'Settings', 'gear'],
  ['audit', '操作记录', 'Audit log', 'log'],
];

export function AdminShell() {
  const { i18n } = useTranslation();
  const zh = i18n.resolvedLanguage !== 'en';
  const language = zh ? 'zh' : 'en';
  const navigate = useNavigate(),
    page = useLocation().pathname.split('/')[2] || 'todo';
  const [todos, setTodos] = useState<AdminTodo[]>([]);
  const [pendingApplications, setPendingApplications] = useState(0);
  const [openFeedback, setOpenFeedback] = useState(0);
  const [feedbackVersion, setFeedbackVersion] = useState(0);
  const [error, setError] = useState('');
  const [fresh, setFresh] = useState(false);
  const [environment, setEnvironment] = useState<string>();
  const [refresh, setRefresh] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);
  useEffect(() => {
    const old = document.querySelector<HTMLLinkElement>('link[rel="manifest"]');
    const previous = old?.getAttribute('href');
    const link = old ?? document.createElement('link');
    link.rel = 'manifest';
    link.href = '/admin-manifest.webmanifest';
    if (!old) document.head.appendChild(link);
    return () => {
      if (old) {
        if (previous === null) old.removeAttribute('href');
        else if (previous !== undefined) old.setAttribute('href', previous);
      } else link.remove();
    };
  }, []);
  useEffect(() => {
    let active = true;
    Promise.all([
      adminRequest<{ items: AdminTodo[] }>('todos'),
      adminRequest<{ fresh: boolean; environment: string }>('session'),
    ])
      .then(([data, s]) => {
        if (active) {
          setTodos(data.items);
          setFresh(s.fresh);
          setEnvironment(s.environment);
          setError('');
        }
      })
      .catch(() => {
        if (active) setError(zh ? '后台数据暂时不可用，请刷新重试' : 'Admin data is unavailable. Refresh to retry.');
      });
    adminRequest<{ items: { state: string }[] }>('applications')
      .then(r => {
        if (active) setPendingApplications(r.items.filter(a => a.state === 'pending').length);
      })
      .catch(() => {});
    adminRequest<{ open: number }>('feedback?filter=open')
      .then(r => {
        if (active) setOpenFeedback(r.open);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [refresh, zh, page, feedbackVersion]);
  useEffect(() => {
    if (!menuOpen) return;
    const close = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenuOpen(false);
    };
    window.addEventListener('keydown', close);
    return () => window.removeEventListener('keydown', close);
  }, [menuOpen]);
  const opened = () => {
    setMenuOpen(false);
    window.scrollTo(0, 0);
  };
  function go(id: string) {
    navigate(`/admin/${id}`);
    opened();
  }
  const badge = (id: string) =>
    id === 'todo' ? todos.length : id === 'applications' ? pendingApplications : id === 'feedback' ? openFeedback : 0;
  const known = entries.find(e => e[0] === page);
  const title =
    page === 'todo'
      ? todos.length
        ? zh
          ? `今天有 ${todos.length} 件事要处理`
          : `${todos.length} ${todos.length === 1 ? 'thing needs' : 'things need'} attention today`
        : zh
          ? '今天没有要处理的事'
          : 'Nothing needs attention today'
      : (known?.[zh ? 1 : 2] ?? (zh ? '页面不存在' : 'Page not found'));
  const today = new Intl.DateTimeFormat(zh ? 'zh-CN' : 'en-US', {
    month: 'long',
    day: 'numeric',
    weekday: 'short',
  }).format(Date.now());
  const envLabel =
    environment === 'preview'
      ? zh
        ? '预览环境'
        : 'Preview'
      : environment === 'production'
        ? zh
          ? '生产环境'
          : 'Production'
        : '';
  let content: ReactNode;
  if (page === 'todo')
    content = (
      <div className="admin-overview">
        <section className="admin-card admin-todos" aria-label={zh ? '待办' : 'To do'}>
          {!error && !todos.length && (
            <p className="admin-empty">{zh ? '当前没有需要处理的待办' : 'No current tasks'}</p>
          )}
          {todos.map(t => (
            <article key={t.id} className="admin-todo" data-level={t.level}>
              <span className="admin-dot" aria-hidden="true" />
              <div>
                <h3>{t.title}</h3>
                <p>{t.text}</p>
              </div>
              <div className="admin-actions">
                {t.actions.map(a => (
                  <a
                    key={a.href}
                    className="admin-chip-link"
                    href={a.href}
                    onClick={e => {
                      const target = a.href.match(/^\/admin\/([\w-]+)$/)?.[1];
                      if (target) {
                        e.preventDefault();
                        go(target);
                      }
                    }}
                  >
                    {a.label}
                  </a>
                ))}
                <BudgetDismissButton todo={t} language={language} onDismissed={() => setRefresh(n => n + 1)} />
              </div>
            </article>
          ))}
        </section>
        <StatusOverview language={language} />
      </div>
    );
  else if (page === 'applications') content = <ApplicationsPage language={language} />;
  else if (page === 'users') content = <UsersPage language={language} />;
  else if (page === 'feedback')
    content = <FeedbackPage language={language} onChange={() => setFeedbackVersion(n => n + 1)} />;
  else if (page === 'audit') content = <AuditPage language={language} />;
  else if (page === 'ledger') content = <FinanceLedger language={language} />;
  else if (page === 'releases') content = <ReleasesPage language={language} />;
  else if (page === 'errors') content = <AdminErrorsPage />;
  else if (page === 'coach')
    content = (
      <>
        <FinanceCosts language={language} />
        <AdminQualityPage />
      </>
    );
  else if (page === 'settings')
    content = (
      <>
        <PromptVersionsPage language={language} />
        <FinanceSettings language={language} />
        <ReviewTemplates language={language} />
        <AdminNotificationSettings />
      </>
    );
  else
    content = (
      <section className="admin-card">
        <p>
          {zh ? '这个页面不存在，请从左侧导航选择。' : 'This page does not exist. Choose a page from the navigation.'}
        </p>
        <button onClick={() => go('todo')}>{zh ? '回到待办' : 'Back to To do'}</button>
      </section>
    );
  return (
    <div className="admin-workspace" style={adminWorkspaceTokens} data-menu={menuOpen ? 'open' : 'closed'}>
      <div className="admin-topbar">
        <span className="admin-brand">
          <span className="admin-brand-mark" aria-hidden="true">
            <AdminIcon name="sprout" />
          </span>
          Fitness {zh ? '后台' : 'Admin'}
        </span>
        <button
          type="button"
          className="admin-menu-button"
          aria-expanded={menuOpen}
          aria-controls="admin-sidebar"
          onClick={() => setMenuOpen(v => !v)}
        >
          <AdminIcon name={menuOpen ? 'close' : 'menu'} />
          {zh ? '菜单' : 'Menu'}
        </button>
      </div>
      <aside id="admin-sidebar">
        <span className="admin-brand">
          <span className="admin-brand-mark" aria-hidden="true">
            <AdminIcon name="sprout" />
          </span>
          Fitness {zh ? '后台' : 'Admin'}
        </span>
        <nav aria-label={zh ? '后台导航' : 'Admin navigation'}>
          {entries.map(([id, zhLabel, enLabel, icon]) => (
            <Link key={id} to={`/admin/${id}`} aria-current={page === id ? 'page' : undefined} onClick={opened}>
              <span className="admin-nav-icon" aria-hidden="true">
                <AdminIcon name={icon} />
              </span>
              <span className="admin-nav-label">{zh ? zhLabel : enLabel}</span>
              {badge(id) > 0 && (
                <span className="admin-badge" aria-label={zh ? `${badge(id)} 项` : `${badge(id)} items`}>
                  {badge(id)}
                </span>
              )}
            </Link>
          ))}
        </nav>
        <p className="admin-privacy">
          {zh
            ? '后台只显示账号、用量、费用和用户主动发来的留言，不显示用户的训练、健康和聊天内容。'
            : 'This console shows accounts, usage, costs and messages users chose to send — never users’ training, health or chat content.'}
        </p>
      </aside>
      {menuOpen && (
        <button
          type="button"
          className="admin-scrim"
          aria-label={zh ? '关闭菜单' : 'Close menu'}
          onClick={() => setMenuOpen(false)}
        />
      )}
      <main>
        <header className="admin-page-header">
          <div>
            <p className="admin-kicker">
              {today}
              {envLabel && ` · ${envLabel}`}
            </p>
            <h1>{title}</h1>
          </div>
          <div className="admin-actions">
            <button onClick={() => setRefresh(n => n + 1)}>
              <AdminIcon name="refresh" />
              {zh ? '刷新' : 'Refresh'}
            </button>
            <button onClick={() => void i18n.changeLanguage(zh ? 'en' : 'zh')}>{zh ? 'English' : '中文'}</button>
          </div>
        </header>
        {environment === 'preview' && (
          <p className="admin-muted admin-note">
            {zh
              ? '本环境包含预览合成用户与费用；合成费用不代表供应商账单。'
              : 'This preview includes synthetic users and costs. Synthetic costs are not supplier charges.'}
          </p>
        )}
        {error && <p role="alert">{error}</p>}
        <div className="admin-page" key={`${page}-${refresh}`}>
          {content}
        </div>
      </main>
      <AdminDialog open={false} title={zh ? '重新验证' : 'Reverify'} onClose={() => {}} onConfirm={reverifyAdmin}>
        <p>{fresh ? '' : zh ? '请重新登录后，再确认操作。' : 'Sign in again, then confirm the operation.'}</p>
      </AdminDialog>
      <AdminToast message="" />
    </div>
  );
}
