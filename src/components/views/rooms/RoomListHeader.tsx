/*
Copyright 2021 The Matrix.org Foundation C.I.C.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

import React from "react";
import { Room } from "matrix-js-sdk/src/models/room";

import { _t } from "../../../languageHandler";
import { useEventEmitterState } from "../../../hooks/useEventEmitter";
import SpaceStore, { UPDATE_SELECTED_SPACE } from "../../../stores/SpaceStore";
import { ChevronFace, ContextMenuButton, ContextMenuTooltipButton, useContextMenu } from "../../structures/ContextMenu";
import SpaceContextMenu from "../context_menus/SpaceContextMenu";
import { HomeButtonContextMenu } from "../spaces/SpacePanel";
import IconizedContextMenu, {
    IconizedContextMenuOption,
    IconizedContextMenuOptionList,
} from "../context_menus/IconizedContextMenu";
import defaultDispatcher from "../../../dispatcher/dispatcher";
import { shouldShowSpaceInvite, showSpaceInvite } from "../../../utils/space";
import { CommunityPrototypeStore } from "../../../stores/CommunityPrototypeStore";
import { ButtonEvent } from "../elements/AccessibleButton";
import Modal from "../../../Modal";
import EditCommunityPrototypeDialog from "../dialogs/EditCommunityPrototypeDialog";
import dis from "../../../dispatcher/dispatcher";
import { Action } from "../../../dispatcher/actions";
import { RightPanelPhases } from "../../../stores/RightPanelStorePhases";
import ErrorDialog from "../dialogs/ErrorDialog";
import { showCommunityInviteDialog } from "../../../RoomInvite";

const contextMenuBelow = (elementRect: DOMRect) => {
    // align the context menu's icons with the icon which opened the context menu
    const left = elementRect.left + window.pageXOffset + 12;
    const top = elementRect.bottom + window.pageYOffset + 12;
    const chevronFace = ChevronFace.None;
    return { left, top, chevronFace };
};

const PrototypeCommunityContextMenu = (props) => {
    const communityId = CommunityPrototypeStore.instance.getSelectedCommunityId();

    let settingsOption;
    if (CommunityPrototypeStore.instance.isAdminOf(communityId)) {
        const onCommunitySettingsClick = (ev: ButtonEvent) => {
            ev.preventDefault();
            ev.stopPropagation();

            Modal.createTrackedDialog('Edit Community', '', EditCommunityPrototypeDialog, {
                communityId: CommunityPrototypeStore.instance.getSelectedCommunityId(),
            });
            props.onFinished();
        };

        settingsOption = (
            <IconizedContextMenuOption
                iconClassName="mx_UserMenu_iconSettings"
                label={_t("Settings")}
                aria-label={_t("Community settings")}
                onClick={onCommunitySettingsClick}
            />
        );
    }

    const onCommunityMembersClick = (ev: ButtonEvent) => {
        ev.preventDefault();
        ev.stopPropagation();

        // We'd ideally just pop open a right panel with the member list, but the current
        // way the right panel is structured makes this exceedingly difficult. Instead, we'll
        // switch to the general room and open the member list there as it should be in sync
        // anyways.
        const chat = CommunityPrototypeStore.instance.getSelectedCommunityGeneralChat();
        if (chat) {
            dis.dispatch({
                action: 'view_room',
                room_id: chat.roomId,
            }, true);
            dis.dispatch({ action: Action.SetRightPanelPhase, phase: RightPanelPhases.RoomMemberList });
        } else {
            // "This should never happen" clauses go here for the prototype.
            Modal.createTrackedDialog('Failed to find general chat', '', ErrorDialog, {
                title: _t('Failed to find the general chat for this community'),
                description: _t("Failed to find the general chat for this community"),
            });
        }
        props.onFinished();
    };

    return <IconizedContextMenu {...props} compact>
        <IconizedContextMenuOptionList first>
            { settingsOption }
            <IconizedContextMenuOption
                iconClassName="mx_UserMenu_iconMembers"
                label={_t("Members")}
                onClick={onCommunityMembersClick}
            />
        </IconizedContextMenuOptionList>
    </IconizedContextMenu>;
};

const RoomListHeader: React.FC = () => {
    const [mainMenuDisplayed, mainMenuHandle, openMainMenu, closeMainMenu] = useContextMenu<HTMLDivElement>();
    const [plusMenuDisplayed, plusMenuHandle, openPlusMenu, closePlusMenu] = useContextMenu<HTMLDivElement>();
    const activeSpace = useEventEmitterState<Room>(SpaceStore.instance, UPDATE_SELECTED_SPACE, () => {
        return SpaceStore.instance.activeSpace;
    });

    const communityId = CommunityPrototypeStore.instance.getSelectedCommunityId();

    let contextMenu: JSX.Element;
    if (mainMenuDisplayed) {
        let ContextMenuComponent;
        if (activeSpace) {
            ContextMenuComponent = SpaceContextMenu;
        } else if (communityId) {
            ContextMenuComponent = PrototypeCommunityContextMenu;
        } else {
            ContextMenuComponent = HomeButtonContextMenu;
        }

        contextMenu = <ContextMenuComponent
            {...contextMenuBelow(mainMenuHandle.current.getBoundingClientRect())}
            space={activeSpace}
            onFinished={closeMainMenu}
            hideHeader={true}
        />;
    } else if (plusMenuDisplayed) {
        let inviteOption: JSX.Element;

        if (shouldShowSpaceInvite(activeSpace)) {
            inviteOption = <IconizedContextMenuOption
                label={_t("Invite to Space")}
                iconClassName="mx_RoomList_iconPlus"
                onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    closePlusMenu();
                    showSpaceInvite(activeSpace);
                }}
            />;
        } else if (CommunityPrototypeStore.instance.canInviteTo(communityId)) {
            const onCommunityInviteClick = (ev: ButtonEvent) => {
                ev.preventDefault();
                ev.stopPropagation();

                showCommunityInviteDialog(CommunityPrototypeStore.instance.getSelectedCommunityId());
                closePlusMenu();
            };

            inviteOption = <IconizedContextMenuOption
                iconClassName="mx_UserMenu_iconInvite"
                label={_t("Invite")}
                onClick={onCommunityInviteClick}
            />;
        }

        contextMenu = <IconizedContextMenu
            {...contextMenuBelow(plusMenuHandle.current.getBoundingClientRect())}
            onFinished={closePlusMenu}
            compact
        >
            <IconizedContextMenuOptionList first>
                <IconizedContextMenuOption
                    label={_t("Start new chat")}
                    iconClassName="mx_RoomList_iconPlus"
                    onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        closePlusMenu();
                        defaultDispatcher.dispatch({ action: "view_create_chat" });
                    }}
                />
                { inviteOption }
            </IconizedContextMenuOptionList>
        </IconizedContextMenu>;
    }

    let title = _t("Home");
    if (activeSpace) {
        title = activeSpace.name;
    } else if (communityId) {
        title = CommunityPrototypeStore.instance.getSelectedCommunityName();
    }

    return <div className="mx_RoomListHeader">
        <ContextMenuButton
            inputRef={mainMenuHandle}
            onClick={openMainMenu}
            isExpanded={mainMenuDisplayed}
            className="mx_RoomListHeader_contextMenuButton"
        >
            { title }
        </ContextMenuButton>
        <ContextMenuTooltipButton
            inputRef={plusMenuHandle}
            onClick={openPlusMenu}
            isExpanded={plusMenuDisplayed}
            className="mx_RoomListHeader_plusButton"
            title={activeSpace ? _t("Add to %(spaceName)s", { spaceName: activeSpace.name }) : _t("Add")}
        />

        { contextMenu }
    </div>;
};

export default RoomListHeader;