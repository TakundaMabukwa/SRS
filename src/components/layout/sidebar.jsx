'use client'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@/components/ui/sidebar'
import { useAuth } from '@/context/auth-context/context'
import { useGlobalContext } from '@/context/global-context/context'

import {
  ChartColumnBig,
  Building2,
  Building,
  Users,
  Truck,
  Route,
  Map,
  UserCircle,
  ChevronDown,
  MapIcon,
  FileText,
  AlertTriangle,
} from 'lucide-react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'

const iconMap = {
  ChartColumnBig: ChartColumnBig,
  Building2: Building2,
  Building: Building,
  Users: Users,
  Truck: Truck,
  UserCircle: UserCircle,
  Map: Map,
  Route: Route,
}

const SideBar = () => {
  const pathname = usePathname()
  const router = useRouter()
  const {
    current_user: {
      currentUser: { costCentre, role, email, permissions },
      currentUser,
    },
    logout,
  } = useAuth()
  const { routes } = useGlobalContext()

  const safeRoutes = Array.isArray(routes) ? routes : []

  return (
    <Sidebar collapsible="icon" className="z-30 border-r border-gray-800 [&_[data-slot=sidebar-inner]]:!bg-black [&_[data-slot=sidebar-inner]]:!text-white">
      <SidebarHeader className="border-b border-gray-800 h-20 justify-center shadow-sm bg-black">
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <SidebarMenuButton
                  size="lg"
                  className="data-[state=open]:bg-gray-900 data-[state=open]:text-white hover:bg-gray-900 text-white"
                  tooltip="Fleet Management"
                >
                  <div className="flex items-center justify-center w-10 h-10 bg-gray-900 rounded-lg">
                    <img
                      src="/image001.png"
                      alt="Soteria Risk Solutions"
                      className="w-8 h-8 object-contain"
                    />
                  </div>
                  <div className="flex flex-col gap-0.5 leading-none text-left">
                    <span className="font-semibold text-white">
                      {`${role} Dashboard` || 'Dashboard'}
                    </span>
                  </div>
                  <ChevronDown className="ml-auto size-4" />
                </SidebarMenuButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                className="w-[--radix-dropdown-menu-trigger-width]"
                align="start"
              >
                <DropdownMenuItem>
                  <span>Fleet Management</span>
                </DropdownMenuItem>
                <DropdownMenuItem>
                  <span>Vehicle Tracking</span>
                </DropdownMenuItem>
                <DropdownMenuItem>
                  <span>Driver Portal</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent className="mt-3">
        <SidebarGroup>
          <SidebarMenu>
            {safeRoutes.length > 0 ? (
              safeRoutes.map((item) => {
                const isActive =
                  item.href === '/'
                    ? pathname === '/'
                    : pathname.startsWith(item.href)
                const Icon = iconMap[item.icon]
                return (
                  <SidebarMenuItem key={item.label}>
                    <SidebarMenuButton
                      asChild
                      className={isActive ? 'bg-white text-black hover:bg-gray-200 font-semibold' : 'text-white hover:bg-gray-800'}
                    >
                      <Link href={item.href}>
                        <Icon className="size-5" />
                        <span className={isActive ? 'font-bold' : undefined}>
                          {item.label}
                        </span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                )
              })
            ) : (
              <div className="p-4 text-sm text-white/70">
                No routes available. Loading...
              </div>
            )}
            <SidebarMenuItem>
              <SidebarMenuButton
                asChild
                className={pathname.startsWith('/video-alerts') ? 'bg-white text-black hover:bg-gray-200 font-semibold' : 'text-white hover:bg-gray-800'}
              >
                <Link href={'/video-alerts'}>
                  <AlertTriangle className="size-5" />
                  <span className={pathname.startsWith('/video-alerts') ? 'font-bold' : undefined}>
                    Video Alerts
                  </span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton
                asChild
                className={pathname.startsWith('/routes') ? 'bg-white text-black hover:bg-gray-200 font-semibold' : 'text-white hover:bg-gray-800'}
              >
                <Link href={'/routes'}>
                  <MapIcon className="size-5" />
                  <span className={pathname.startsWith('/routes') ? 'font-bold' : undefined}>
                    Routes
                  </span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton
                asChild
                className={pathname.startsWith('/audit') ? 'bg-white text-black hover:bg-gray-200 font-semibold' : 'text-white hover:bg-gray-800'}
              >
                <Link href={'/audit'}>
                  <FileText className="size-5" />
                  <span className={pathname.startsWith('/audit') ? 'font-bold' : undefined}>
                    Audit
                  </span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="border-t border-gray-800">
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <SidebarMenuButton size="lg" tooltip="User Profile" className="text-white hover:bg-gray-800">
                  <div className="flex aspect-square size-8 items-center justify-center rounded-full bg-white text-black">
                    <UserCircle className="size-5" />
                  </div>
                  <div className="flex flex-col gap-0.5 leading-none">
                    <span className="font-medium capitalize">
                      {role || 'User'}
                    </span>
                    <span className="text-xs text-white/70">
                      {email}
                    </span>
                  </div>
                  <ChevronDown className="ml-auto size-4" />
                </SidebarMenuButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                side="top"
                className="w-[--radix-dropdown-menu-trigger-width]"
                align="start"
              >
                <DropdownMenuItem>
                  <span>Profile</span>
                </DropdownMenuItem>
                <DropdownMenuItem>
                  <span>Settings</span>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => logout(router)}>
                  <span>Sign out</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  )
}

export default SideBar
