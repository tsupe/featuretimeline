import { Action } from 'redux';
import { WorkItemType, WorkItemStateColor } from 'azure-devops-extension-api/WorkItemTracking';
import { IDictionaryStringTo } from '../../../../Common/redux/Contracts/types';

export const WorkItemTypesReceivedActionType = '@@workitemmetadata/WorkItemTypesReceived';
export const WorkItemStateColorsReceivedActionType = '@@workitemmetadata/WorkItemStateColorsReceived';

export interface WorkItemTypesReceivedAction extends Action {
    type: '@@workitemmetadata/WorkItemTypesReceived';
    payload: {
        projectId: string;
        workItemTypes: WorkItemType[];
    }
}

export interface WorkItemStateColorsReceivedAction extends Action {
    type: '@@workitemmetadata/WorkItemStateColorsReceived';
    payload: {
        projectId: string;
        workItemTypeStateColors: IDictionaryStringTo<WorkItemStateColor[]>;
    }
}

export type MetaDataActions = WorkItemTypesReceivedAction | WorkItemStateColorsReceivedAction;