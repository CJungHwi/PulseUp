/**

 * MonitorDisplayTabs — 모니터 기본/인트로/영상앱 표시 탭 UI

 */

import React, { useState } from 'react'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

import { Button } from '@/components/ui/button'

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

import { Save } from 'lucide-react'

import {

  MonitorImageTripleUpload,

  type MonitorImageTripleValues,

  type MonitorSide

} from './MonitorImageTripleUpload'

import { MonitorDisplayTextField } from './MonitorDisplayTextField'

import type { RefObject } from 'react'



export type MonitorDisplayProfileState = {

  defaultImages: MonitorImageTripleValues

  introImages: MonitorImageTripleValues

  displayText: string

}



type SideBusy = { isUploading: boolean; isDeleting: boolean }



export type MonitorDisplayTabsProps = {

  variant?: 'card' | 'embedded'

  showSaveButtons?: boolean

  userProfile: MonitorDisplayProfileState

  onUserDefaultChange: (side: MonitorSide, value: string) => void

  onUserIntroChange: (side: MonitorSide, value: string) => void

  onUserDisplayTextChange: (value: string) => void

  userFileInputRefs: Record<'default' | 'intro', Record<MonitorSide, RefObject<HTMLInputElement | null>>>

  onUserFileChange: (imageKind: 'default' | 'intro', side: MonitorSide, file: File) => void

  onUserDelete: (imageKind: 'default' | 'intro', side: MonitorSide) => void

  userUploadState: Record<'default' | 'intro', Record<MonitorSide, SideBusy>>

  onSaveUser: () => void

  isSavingUser: boolean

  isAdmin: boolean

  systemProfile?: MonitorDisplayProfileState

  onSystemDefaultChange?: (side: MonitorSide, value: string) => void

  onSystemIntroChange?: (side: MonitorSide, value: string) => void

  onSystemDisplayTextChange?: (value: string) => void

  systemFileInputRefs?: Record<'default' | 'intro', Record<MonitorSide, RefObject<HTMLInputElement | null>>>

  onSystemFileChange?: (imageKind: 'default' | 'intro', side: MonitorSide, file: File) => void

  onSystemDelete?: (imageKind: 'default' | 'intro', side: MonitorSide) => void

  systemUploadState?: Record<'default' | 'intro', Record<MonitorSide, SideBusy>>

  onSaveSystem?: () => void

  isSavingSystem?: boolean

}



const emptyBusy = (): Record<MonitorSide, SideBusy> => ({

  left: { isUploading: false, isDeleting: false },

  center: { isUploading: false, isDeleting: false },

  right: { isUploading: false, isDeleting: false }

})



export const MonitorDisplayTabs: React.FC<MonitorDisplayTabsProps> = ({

  variant = 'card',

  showSaveButtons = true,

  userProfile,

  onUserDefaultChange,

  onUserIntroChange,

  onUserDisplayTextChange,

  userFileInputRefs,

  onUserFileChange,

  onUserDelete,

  userUploadState,

  onSaveUser,

  isSavingUser,

  isAdmin,

  systemProfile,

  onSystemDefaultChange,

  onSystemIntroChange,

  onSystemDisplayTextChange,

  systemFileInputRefs,

  onSystemFileChange,

  onSystemDelete,

  systemUploadState,

  onSaveSystem,

  isSavingSystem

}) => {

  const [activeTab, setActiveTab] = useState('default-images')



  const renderImageSection = (

    scope: 'user' | 'system',

    imageKind: 'default' | 'intro',

    values: MonitorImageTripleValues,

    onChange: (side: MonitorSide, v: string) => void

  ) => {

    const refs =

      scope === 'user'

        ? userFileInputRefs[imageKind]

        : systemFileInputRefs?.[imageKind]

    const uploadState =

      scope === 'user'

        ? userUploadState[imageKind]

        : systemUploadState?.[imageKind] ?? emptyBusy()

    const onFile =

      scope === 'user'

        ? (side: MonitorSide, file: File) => onUserFileChange(imageKind, side, file)

        : (side: MonitorSide, file: File) => onSystemFileChange?.(imageKind, side, file)

    const onDel =

      scope === 'user'

        ? (side: MonitorSide) => onUserDelete(imageKind, side)

        : (side: MonitorSide) => onSystemDelete?.(imageKind, side)



    if (!refs || !onFile || !onDel) return null



    return (

      <MonitorImageTripleUpload

        values={values}

        onChange={onChange}

        fileInputRefs={refs}

        onFileChange={onFile}

        onDelete={onDel}

        uploadState={uploadState}

      />

    )

  }



  const renderUserHeader = (label: string) => {

    if (!showSaveButtons && variant === 'embedded') return null

    return (

      <div className="flex items-center justify-between">

        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">

          {label}

        </span>

        {showSaveButtons ? (

          <Button className="h-7 text-xs" onClick={onSaveUser} disabled={isSavingUser}>

            <Save className="h-3.5 w-3.5 mr-1" />

            저장

          </Button>

        ) : null}

      </div>

    )

  }



  const tabPanels = (

    <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">

      <TabsList className="mb-4">

        <TabsTrigger value="default-images">기본 이미지</TabsTrigger>

        <TabsTrigger value="intro-images">인트로 이미지</TabsTrigger>

        <TabsTrigger value="display-text">영상앱 표시</TabsTrigger>

      </TabsList>



      <TabsContent value="default-images" className="space-y-5">

        {renderUserHeader('내 기본 이미지')}

        {renderImageSection('user', 'default', userProfile.defaultImages, onUserDefaultChange)}



        {isAdmin && systemProfile && onSystemDefaultChange && onSaveSystem ? (

          <div className="space-y-3 border-t pt-4">

            <div className="flex items-center justify-between">

              <span className="text-xs font-semibold text-amber-600 dark:text-amber-400 uppercase tracking-wide">

                시스템 기본 이미지

              </span>

              {showSaveButtons ? (

                <Button className="h-7 text-xs" onClick={onSaveSystem} disabled={isSavingSystem}>

                  <Save className="h-3.5 w-3.5 mr-1" />

                  저장

                </Button>

              ) : null}

            </div>

            {renderImageSection('system', 'default', systemProfile.defaultImages, onSystemDefaultChange)}

          </div>

        ) : null}

      </TabsContent>



      <TabsContent value="intro-images" className="space-y-5">

        {renderUserHeader('내 인트로 이미지')}

        {renderImageSection('user', 'intro', userProfile.introImages, onUserIntroChange)}



        {isAdmin && systemProfile && onSystemIntroChange && onSaveSystem ? (

          <div className="space-y-3 border-t pt-4">

            <div className="flex items-center justify-between">

              <span className="text-xs font-semibold text-amber-600 dark:text-amber-400 uppercase tracking-wide">

                시스템 인트로 이미지

              </span>

              {showSaveButtons ? (

                <Button className="h-7 text-xs" onClick={onSaveSystem} disabled={isSavingSystem}>

                  <Save className="h-3.5 w-3.5 mr-1" />

                  저장

                </Button>

              ) : null}

            </div>

            {renderImageSection('system', 'intro', systemProfile.introImages, onSystemIntroChange)}

          </div>

        ) : null}

      </TabsContent>



      <TabsContent value="display-text" className="space-y-5">

        {renderUserHeader('내 영상앱 표시')}

        <MonitorDisplayTextField

          value={userProfile.displayText}

          onChange={onUserDisplayTextChange}

        />



        {isAdmin && systemProfile && onSystemDisplayTextChange && onSaveSystem ? (

          <div className="space-y-3 border-t pt-4">

            <div className="flex items-center justify-between">

              <span className="text-xs font-semibold text-amber-600 dark:text-amber-400 uppercase tracking-wide">

                시스템 영상앱 표시

              </span>

              {showSaveButtons ? (

                <Button className="h-7 text-xs" onClick={onSaveSystem} disabled={isSavingSystem}>

                  <Save className="h-3.5 w-3.5 mr-1" />

                  저장

                </Button>

              ) : null}

            </div>

            <MonitorDisplayTextField

              value={systemProfile.displayText}

              onChange={onSystemDisplayTextChange}

            />

          </div>

        ) : null}

      </TabsContent>

    </Tabs>

  )



  if (variant === 'embedded') {

    return tabPanels

  }



  return (

    <Card className="flex-[1] min-h-0 border border-[#343637] dark:border-[#6b7280] shadow-md overflow-auto">

      <CardHeader className="h-12 px-4 py-0 border-b bg-muted/20 flex flex-row items-center justify-between space-y-0 border-[#343637] dark:border-[#6b7280]">

        <CardTitle className="text-sm font-bold">모니터 표시 설정</CardTitle>

      </CardHeader>

      <CardContent className="p-4">{tabPanels}</CardContent>

    </Card>

  )

}


