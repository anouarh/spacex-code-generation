import { AmatService } from 'src/app/shared/services/amat.service';
import { DialogUtilService } from 'src/app/shared/services/dialog-util.service';
import { NotifService } from 'src/app/shared/services/notification.service';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit } from '@angular/core';
import { FormControl, FormGroup } from '@angular/forms';
import { GridComponent } from '@progress/kendo-angular-grid';

const createFormGroup: (item: any) => FormGroup = (dataItem: any) =>
    new FormGroup({
    });

const editFormGroup: (item: any) => FormGroup = (dataItem: any) =>
    new FormGroup({
    });

@Component({
    selector: 'app-fournisseurs',
    templateUrl: './fournisseurs.component.html',
    styleUrls: ['./fournisseurs.component.scss'],
})
export class FournisseursComponent implements OnInit {

    // TODO: De préférence typer vos variables
    isLoading: boolean = false;
    data: any[] = [];
    editDataModel: any;
    editedRowIndex: any;
    originalItem: any;
    dataItemToDelete: any;
    formGroup: FormGroup | undefined;

    constructor(private amat: AmatService, private notificationService: NotifService, private dialogueService: DialogUtilService) { }

     ngOnInit(): void {
        this.getAllData();
    }

    getAllData() {
        this.isLoading = true;
        this.amat.getBe("FRS").subscribe((result) => {     
            this.isLoading = false;       
        }, (error: Error) => {
            this.handleReadError(error);
            this.isLoading = false; 
        });
    }

    addHandler(event: any) {
            const { sender } = event;
            this.editDataModel = {};
            this.formGroup = createFormGroup({});
            this.closeEditor(sender);
            sender.addRow(this.formGroup);
    }

    editHandler(event: any) {
            const { sender, rowIndex, dataItem } = event;
            this.originalItem = Object.assign({}, dataItem);
            this.editDataModel = dataItem;
            this.formGroup = editFormGroup(this.originalItem);
            this.closeEditor(sender);
            this.editedRowIndex = rowIndex;
            sender.editRow(rowIndex, this.formGroup);
    }

    cancelHandler({ sender, rowIndex }: any) {
            Object.assign(this.editDataModel, this.originalItem);
            this.closeEditor(sender, rowIndex);
        
    }

    saveHandler({ sender, rowIndex, isNew }: any) {
        this.isLoading = true;
        const item: any = Object.assign(this.editDataModel, this.formGroup?.value);
        if (isNew) {
            const body = { dsFRS: { 'prods:hasChanges': true, ttFRS: [item] } };
            this.amat.postBe("FRS", body).subscribe((res: any) => {
                this.notificationService.showSuccess('Bien enregistré');
                this.data.push(item);
                this.isLoading = false;
            }, (error) => {
                this.handleCUDError(error);
                this.isLoading = false;
            })
        } else {
            const body = {
                dsFRS: {
                    'prods:hasChanges': true,
                    ttFRS: [item],
                    'prods:before': {
                        ttFRS: [
                            this.originalItem
                        ]
                    }
                }
            };
            this.amat.putBe("FRS", body).subscribe((res: any) => {
                this.notificationService.showSuccess('Bien enregistré');
                this.isLoading = false;
            }, (error) => {
                this.handleCUDError(error);
                this.isLoading = false;
            })
        }
        sender.closeRow(rowIndex);
    }

    removeHandler(event: any) {
        this.dataItemToDelete = event.dataItem;
        const dialog = this.dialogueService.showConfirmation(`Etes vous sûr de vouloir supprimer?`);
        dialog.result.subscribe((res: any) => {
            if (res.text == "Oui") {
                const body = {
                    dsFRS: {
                        'prods:hasChanges': true,
                        'prods:before': {
                            ttFRS: [
                                {
                                    'prods:clientId': '1665586625210-5',
                                    'prods:rowState': 'deleted',
                                    ...this.dataItemToDelete
                                }
                            ]
                        }
                    }
                };
                this.amat.deleteBe("FRS", body).subscribe((res: any) => {
                    this.notificationService.showSuccess('Bien supprimé');
                    // TODO: Replacer avec la condition de votre choix
                    /* const index = this.data.findIndex((d) => d.attribute == this.dataItemToDelete.attribute);
                    if (index != -1) this.data.splice(index, 1);*/                    
                }, (error) => { this.handleCUDError(error); })
            }
        })
    }

    private closeEditor(grid: GridComponent, rowIndex: number = this.editedRowIndex!): void {
        grid.closeRow(rowIndex);
        this.editedRowIndex = undefined;
    }

    private handleReadError(error: any) {
        this.dialogueService.showError(this.amat.parseError(error));
    }

    private handleCUDError(myHttpErrorResponse: HttpErrorResponse) {
        this.dialogueService.showError(this.amat.parseError(myHttpErrorResponse));
    }

}