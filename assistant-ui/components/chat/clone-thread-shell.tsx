'use client';

import {
  ThreadList,
  ThreadListItems,
  ThreadListNew,
  ThreadListRoot,
  ThreadListSearch,
} from '@/components/assistant-ui/elements/thread-list.aui';
import { TooltipIconButton } from '@/components/assistant-ui/elements/tooltip-icon-button';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { useAuiState } from '@assistant-ui/react';
import { MenuIcon, PanelLeftIcon } from 'lucide-react';
import { useEffect, useState, type FC, type MouseEvent, type ReactNode } from 'react';

type CloneThreadShellProps = {
  children: ReactNode;
  railClassName?: string | undefined;
  collapsed?: boolean | undefined;
  onCollapsedChange?: ((value: boolean) => void) | undefined;
  mobileSidebarOpen?: boolean | undefined;
  onMobileSidebarOpenChange?: ((value: boolean) => void) | undefined;
  headerContent?: ReactNode | undefined;
  sheetTitle?: ReactNode | undefined;
  showSearch?: boolean | undefined;
  wrapNewThreadTooltip?: boolean | undefined;
};

const SIDEBAR_COLLAPSED_KEY = 'versatile-agent.sidebar-collapsed';

export const CloneThreadShell: FC<CloneThreadShellProps> = ({
  children,
  railClassName,
  collapsed,
  onCollapsedChange,
  mobileSidebarOpen,
  onMobileSidebarOpenChange,
  headerContent,
  sheetTitle,
  showSearch = true,
  wrapNewThreadTooltip = false,
}) => {
  // Open by default: the conversation list is the point of the rail, and a
  // collapsed start hides it behind a 48px strip. The user's own toggle is
  // remembered so it does not spring back open on every reload.
  const [internalCollapsed, setInternalCollapsed] = useState(false);
  const [internalMobileOpen, setInternalMobileOpen] = useState(false);
  const [search, setSearch] = useState('');

  // Read after mount: the server has no access to localStorage, and reading it
  // during render would desync hydration.
  useEffect(() => {
    const stored = window.localStorage.getItem(SIDEBAR_COLLAPSED_KEY);
    if (stored !== null) setInternalCollapsed(stored === 'true');
  }, []);
  const hasThreads = useAuiState((s) => s.threads.threadIds.length > 0);

  // A controlled value means the caller renders the chrome that drives it, so
  // the shell omits its own toggle / trigger and forwards changes instead.
  const collapsedControlled = collapsed !== undefined;
  const mobileControlled = mobileSidebarOpen !== undefined;

  const sidebarCollapsed = collapsed ?? internalCollapsed;
  const mobileOpen = mobileSidebarOpen ?? internalMobileOpen;

  const setSidebarCollapsed = (value: boolean) => {
    if (!collapsedControlled) {
      setInternalCollapsed(value);
      window.localStorage.setItem(SIDEBAR_COLLAPSED_KEY, String(value));
    }
    onCollapsedChange?.(value);
  };
  const setMobileOpen = (open: boolean) => {
    if (!mobileControlled) setInternalMobileOpen(open);
    onMobileSidebarOpenChange?.(open);
  };

  const closeMobileSidebarAfterNavigation = (event: MouseEvent<HTMLDivElement>) => {
    if (!(event.target instanceof Element)) return;
    if (
      event.target.closest(
        '[data-slot="aui_thread-list-item-trigger"], [data-slot="aui_thread-list-new"]'
      )
    ) {
      setMobileOpen(false);
    }
  };

  const newThread = (
    <ThreadListNew
      className={cn(
        'overflow-hidden transition-all duration-200',
        sidebarCollapsed
          ? 'w-8 gap-0 px-2 has-[>svg]:px-2'
          : 'w-full gap-2 px-2.5 has-[>svg]:px-2.5'
      )}
      labelClassName={cn(
        'overflow-hidden transition-all duration-200',
        sidebarCollapsed ? 'max-w-0 opacity-0' : 'max-w-24 opacity-100'
      )}
    />
  );

  return (
    <div className="relative flex h-full w-full overflow-hidden">
      <aside
        className={cn(
          'hidden h-full shrink-0 flex-col overflow-hidden border-r border-white/10 bg-black text-[#FFD589] transition-[width] duration-200 md:flex',
          railClassName,
          sidebarCollapsed ? 'w-12' : 'w-65'
        )}
      >
        <div className="flex h-12 shrink-0 items-center overflow-hidden px-2">
          {!collapsedControlled && (
            <TooltipIconButton
              variant="ghost"
              size="icon"
              tooltip={
                sidebarCollapsed ? 'Afficher la barre latérale' : 'Masquer la barre latérale'
              }
              side="right"
              onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
              className="text-[#FFD589] hover:bg-white/10 hover:text-[#FFD589] size-8"
            >
              <PanelLeftIcon className="size-4" />
            </TooltipIconButton>
          )}
          {headerContent !== undefined
            ? headerContent
            : !sidebarCollapsed && <span className="ml-2 truncate text-sm font-medium">Chats</span>}
        </div>

        <ThreadListRoot
          className={cn(
            'relative flex-1 transition-[padding,width] duration-200',
            sidebarCollapsed ? 'w-12 overflow-hidden px-2 pt-1' : 'w-65 overflow-y-auto p-3'
          )}
        >
          {wrapNewThreadTooltip ? (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger render={newThread} />
                {sidebarCollapsed && <TooltipContent side="right">Nouveau chat</TooltipContent>}
              </Tooltip>
            </TooltipProvider>
          ) : (
            newThread
          )}
          {showSearch && hasThreads && (
            <div
              aria-hidden={sidebarCollapsed}
              inert={sidebarCollapsed}
              className={cn(
                'transition-opacity duration-150',
                sidebarCollapsed && 'pointer-events-none opacity-0'
              )}
            >
              <ThreadListSearch value={search} onValueChange={setSearch} />
            </div>
          )}
          <ThreadListItems
            searchQuery={showSearch && hasThreads ? search : ''}
            aria-hidden={sidebarCollapsed}
            inert={sidebarCollapsed}
            className={cn(
              'transition-[opacity,transform] duration-150',
              sidebarCollapsed ? 'pointer-events-none opacity-0' : 'translate-x-0 opacity-100'
            )}
          />
        </ThreadListRoot>
      </aside>

      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        {!mobileControlled && (
          <div className="absolute top-2 left-2 z-20 md:hidden">
            <SheetTrigger
              render={
                <Button variant="ghost" size="icon" className="bg-background/70 size-8">
                  <MenuIcon className="size-4" />
                  <span className="sr-only">Ouvrir l’historique des chats</span>
                </Button>
              }
            />
          </div>
        )}
        <SheetContent side="left" className="flex flex-col bg-black p-0 text-[#FFD589]">
          <SheetTitle className="flex h-12 shrink-0 items-center px-4 text-sm font-medium">
            {sheetTitle ?? 'Chats'}
          </SheetTitle>
          <div
            className="relative flex-1 overflow-y-auto p-3"
            onClick={closeMobileSidebarAfterNavigation}
          >
            <ThreadList />
          </div>
        </SheetContent>
      </Sheet>

      <div className="min-w-0 flex-1 overflow-hidden">{children}</div>
    </div>
  );
};
