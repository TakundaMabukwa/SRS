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
  // console.log('currentUser :>> ', currentUser?.company)

  // Ensure routes is always an array
  const safeRoutes = Array.isArray(routes) ? routes : []

  return (
    <Sidebar collapsible="icon" className="z-30 border-r border-[#131b46] [&_[data-slot=sidebar-inner]]:!bg-[#1A245E] [&_[data-slot=sidebar-inner]]:!text-white">
      <SidebarHeader className="border-b border-[#131b46] h-16 justify-center shadow-sm">
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <SidebarMenuButton
                  size="lg"
                  className="data-[state=open]:bg-[#243066] data-[state=open]:text-[#FFD700] hover:bg-[#243066] text-white"
                  tooltip="Fleet Management"
                >
                  <img
                    src="/Prem-logo_.png"
                    alt="Premier Cross Border"
                    className="w-8 h-8 rounded-lg object-contain bg-white"
                  />
                  <div className="flex flex-col gap-0.5 leading-none">
                    <span className="font-semibold text-white">
                      {currentUser?.company || 'Premier Cross Border'}
                    </span>
                    <span className="text-xs text-white/80 capitalize">
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
                      className={isActive ? 'bg-[#243066] text-[#FFD700]' : 'text-white hover:bg-[#243066] hover:text-[#FFD700]'}
                    >
                      <Link href={item.href}>
                        <Icon className={isActive ? 'text-[#FFD700]' : 'text-white group-hover:text-[#FFD700]'} />
                        <span className={isActive ? 'font-bold' : undefined}>
                          {item.label}
                        </span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                )
              })
            ) : (
              <div className="p-4 text-sm text-gray-500">
                No routes available. Loading...
              </div>
            )}
            <SidebarMenuItem>
              <SidebarMenuButton
                asChild
                className={pathname.startsWith('/video-alerts') ? 'bg-[#243066] text-[#FFD700]' : 'text-white hover:bg-[#243066] hover:text-[#FFD700]'}
              >
                <Link href={'/video-alerts'}>
                  <AlertTriangle
                    className={
                      pathname.startsWith('/video-alerts') ? 'text-[#FFD700]' : 'text-white group-hover:text-[#FFD700]'
                    }
                  />
                  <span
                    className={
                      pathname.startsWith('/video-alerts') ? 'font-bold' : undefined
                    }
                  >
                    Video Alerts
                  </span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton
                asChild
                className={pathname.startsWith('/routes') ? 'bg-[#243066] text-[#FFD700]' : 'text-white hover:bg-[#243066] hover:text-[#FFD700]'}
              >
                <Link href={'/routes'}>
                  <MapIcon
                    className={
                      pathname.startsWith('/routes') ? 'text-[#FFD700]' : 'text-white group-hover:text-[#FFD700]'
                    }
                  />
                  <span
                    className={
                      pathname.startsWith('/routes') ? 'font-bold' : undefined
                    }
                  >
                    Routes
                  </span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton
                asChild
                className={pathname.startsWith('/audit') ? 'bg-[#243066] text-[#FFD700]' : 'text-white hover:bg-[#243066] hover:text-[#FFD700]'}
              >
                <Link href={'/audit'}>
                  <FileText
                    className={
                      pathname.startsWith('/audit') ? 'text-[#FFD700]' : 'text-white group-hover:text-[#FFD700]'
                    }
                  />
                  <span
                    className={
                      pathname.startsWith('/audit') ? 'font-bold' : undefined
                    }
                  >
                    Audit
                  </span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="border-t border-[#131b46]">
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <SidebarMenuButton size="lg" tooltip="User Profile" className="text-white hover:bg-[#243066] hover:text-[#FFD700]">
                  <div className="flex aspect-square size-8 items-center justify-center rounded-full bg-[#243066] text-[#FFD700]">
                    <UserCircle className="size-5" />
                  </div>
                  <div className="flex flex-col gap-0.5 leading-none ">
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
