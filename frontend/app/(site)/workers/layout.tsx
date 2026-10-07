'use client'

import { useEffect } from 'react'
import { redirect } from 'next/navigation'
import { useAppContext } from '@/app/context/app.context'
import { workersUsersList } from '@/app/interfaces/user.interface'

export default function WorkersLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { mainData } = useAppContext()
  const { user } = mainData.users

  useEffect(() => {
    if (user === undefined) {
      redirect('/')
      return
    }
    if (user && !workersUsersList.includes(user.role)) {
      redirect('/dashboard')
    }
  }, [user])

  return <>{children}</>
}
