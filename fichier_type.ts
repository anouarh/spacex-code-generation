import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit } from '@angular/core';
import { FormControl, FormGroup, Validators } from '@angular/forms';
import { GridComponent, SelectableSettings } from '@progress/kendo-angular-grid';
import { DateTime } from 'luxon';
import { forkJoin } from 'rxjs';
import { mergeMap } from 'rxjs/operators';
import { DropDownItem } from 'src/app/shared/models/dropdown-item.model';
import { TresoFiltreDetail } from 'src/app/shared/models/tresofiltredetail.model';
import { AmatService } from 'src/app/shared/services/amat.service';
import { DialogUtilService } from 'src/app/shared/services/dialog-util.service';
import { NotifService } from 'src/app/shared/services/notification.service';

interface TypeProvenance {
    typeProvenance: string;
    nomChamp: string;
    Libelle: string;
    typeDonnee: string;
}

interface TresoFiltre {
    seq?: number,
    idROWID?: string;
    codeFiltre?: string;
    Libelle?: string;
    typeProvenance?: string;
}

const createFormGroup: (item: any) => FormGroup = (dataItem: any) =>
    new FormGroup({
        codeFiltre: new FormControl(dataItem.codeFiltre, Validators.required),
        Libelle: new FormControl(dataItem.Libelle),
        typeProvenance: new FormControl(dataItem.typeProvenance),
    });

const editFormGroup: (item: any) => FormGroup = (dataItem: any) =>
    new FormGroup({
        codeFiltre: new FormControl(dataItem.codeFiltre),
        Libelle: new FormControl(dataItem.Libelle),
        typeProvenance: new FormControl(dataItem.typeProvenance),
    });

@Component({
    selector: 'app-gestion-filtres',
    templateUrl: './gestion-filtres.component.html',
    styleUrls: ['./gestion-filtres.component.scss'],
})
export class GestionFiltresComponent implements OnInit {

    isLoading: boolean = false;
    data: TresoFiltre[] = [];
    filteredData: TresoFiltre[] = [];
    filtreDetails: TresoFiltreDetail[] = [];
    detailsFiltered: TresoFiltreDetail[] = [];
    typeProvenanceData: DropDownItem[] = [{ value: "ALL", viewValue: "Toutes" }, { value: "GL", viewValue: "Grand livre" }, { value: "BANQEX", viewValue: "Relevé" }];
    selectedFiltre: DropDownItem = this.typeProvenanceData[0];
    selectableSettings: boolean | SelectableSettings = {
        mode: 'single',
        enabled: true
    };
    selectedRow: number[] = [0];
    criteteSelectedRow: number[] = [0];
    formGroup: FormGroup | undefined;
    editDataModel!: TresoFiltre;
    editedRowIndex: number | undefined;
    originalItem!: TresoFiltre;
    dataItemToDelete!: TresoFiltre;
    tpData: DropDownItem[] = [{ value: "GL", viewValue: "Grand livre" }, { value: "BANQEX", viewValue: "Relevé" }];
    crudMode: boolean = false;
    detailsCrudMode: boolean = false;
    currentFilter!: TresoFiltre;
    originalDetail!: TresoFiltreDetail;
    editDetailDataModel!: TresoFiltreDetail;
    currentDetail!: TresoFiltreDetail;
    detailToDelete!: TresoFiltreDetail;
    editedDetailRowIndex!: number | undefined;
    champAfiltrerData: TypeProvenance[] = [];
    filteredchampAfiltrerData: TypeProvenance[] = [];
    conditions: DropDownItem[] = [{ value: "EGAL", viewValue: "Egal" }, { value: "DIFF", viewValue: "Différent" }, { value: "CONTIENT", viewValue: "Contient" }, { value: "NOTCONT", viewValue: "Ne contient pas" }, { value: "SUP", viewValue: "Supérieur" }, { value: "INF", viewValue: "Inférieur" }, { value: "SUPEGAL", viewValue: "Supérieur ou égal" }, { value: "INFEGAL", viewValue: "Inférieur ou égal" }];
    showDate: boolean = false;
    showString: boolean = true;
    showInteger: boolean = false;
    isEgal: boolean = false;
    valeurFormat: string = "#";
    currentTypeProvenance?: TypeProvenance;
    detailMode: string = "add";
    logicalCharPredicate: boolean = false;
    intDecDatePredicate: boolean = false;

    detailFiltreForm = new FormGroup({
        champFiltre: new FormControl(),
        typeCritere: new FormControl(),
        valeur: new FormControl(),
        intValeur: new FormControl(),
        dateValeur: new FormControl(),
        position: new FormControl(0),
        longueur: new FormControl(0),
    });

    constructor(private amat: AmatService, private notificationService: NotifService, private dialogueService: DialogUtilService) { }

    ngOnInit(): void {
        this.detailFiltreForm.disable();
        this.getAllData();
    }

    getAllData() {
        this.isLoading = true;
        this.amat.getBe("TRESOFILTRE").pipe(mergeMap((res: any) => {
            this.data = res.dsTRESOFILTRE.ttTRESOFILTRE;
            this.currentFilter = this.data[0];
            const details = this.amat.getBe("TRESOFILTREDETAILS");
            const champs = this.amat.get("procedure/TableFields?typeProvenance=ALL");
            return forkJoin([details, champs]);
        })).subscribe((result) => {
            this.filtreDetails = result[0].dsTRESOFILTREDETAILS.ttTRESOFILTREDETAILS;
            this.filteredData = [...this.data];
            this.detailsFiltered = this.filtreDetails.filter((f: any) => f.codeFiltre == this.filteredData[0].codeFiltre);
            this.champAfiltrerData = result[1].ListeFields;
            this.filteredchampAfiltrerData = this.champAfiltrerData.filter((c) => c.typeProvenance == this.filteredData[0].typeProvenance);
            this.filteredchampAfiltrerData.sort((a, b) => (a.Libelle < b.Libelle ? -1 : 1));
            this.toggleEgal(this.detailsFiltered[0]?.typeCritere);
            const tp = this.filteredchampAfiltrerData.find((t) => t.nomChamp == this.detailsFiltered[0]?.champFiltre);
            if (tp != null) this.showValueType(tp);
            this.patchDetailForm(this.detailsFiltered[0]);
            this.currentDetail = this.detailsFiltered[0];
            this.currentTypeProvenance = this.filteredchampAfiltrerData.find((f) => f.typeProvenance == this.detailsFiltered[0]?.champFiltre)
        }, (error: Error) => {
            this.handleReadError(error);
        });
    }

    editHandler(event: any) {
        if (!this.detailsCrudMode) {
            this.crudMode = true;
            const { sender, rowIndex, dataItem } = event;
            this.selectedRow = [rowIndex];
            this.originalItem = Object.assign({}, dataItem);
            this.editDataModel = dataItem;
            this.formGroup = editFormGroup(this.originalItem);
            this.formGroup.controls['codeFiltre'].disable();
            this.closeEditor(sender);
            this.editedRowIndex = rowIndex;
            sender.editRow(rowIndex, this.formGroup);
        } else {
            this.notificationService.showWarning("Modification critère de filtre en cours");
        }
    }

    cancelHandler({ sender, rowIndex }: any) {
        if (this.crudMode) {
            if (this.editDataModel) Object.assign(this.editDataModel, this.originalItem);
            this.closeEditor(sender, rowIndex);
            this.crudMode = false;
        } else if (this.detailsCrudMode) {
            if (this.editDetailDataModel) Object.assign(this.editDetailDataModel, this.originalDetail);
            this.closeEditor(sender, rowIndex);
            this.detailsCrudMode = false;
        } else { ; }
    }

    saveHandler({ sender, rowIndex, isNew }: any) {
        this.isLoading = true;
        const item: any = Object.assign(this.editDataModel, this.formGroup?.value);
        if (isNew) {
            const body = { dsTRESOFILTRE: { 'prods:hasChanges': true, ttTRESOFILTRE: [item] } };
            this.amat.postBe("TRESOFILTRE", body).subscribe((res: any) => {
                this.notificationService.showSuccess('Bien enregistré');
                this.data.push(item);
                this.filteredData.unshift(item);
                if (this.selectedFiltre.value != "ALL") { this.filteredData = this.data.filter((d: any) => d.typeProvenance == this.selectedFiltre.value); }
                this.crudMode = false;
                this.resfreshToAll();
                this.isLoading = false;
            }, (error) => {
                this.handleCUDError(error);
                this.isLoading = false;
            })
        } else {
            const body = {
                dsTRESOFILTRE: {
                    'prods:hasChanges': true,
                    ttTRESOFILTRE: [item],
                    'prods:before': {
                        ttTRESOFILTRE: [
                            this.originalItem
                        ]
                    }
                }
            };
            this.amat.putBe("TRESOFILTRE", body).subscribe((res: any) => {
                this.notificationService.showSuccess('Bien enregistré'); this.crudMode = false;
                this.resfreshToAll();
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
        const dialog = this.dialogueService.showConfirmation(`Etes vous sûr de vouloir supprimer le filtre ${this.dataItemToDelete.Libelle} ?`);
        dialog.result.subscribe((res: any) => {
            if (res.text == "Oui") {
                const body = {
                    dsTRESOFILTRE: {
                        'prods:hasChanges': true,
                        'prods:before': {
                            ttTRESOFILTRE: [
                                {
                                    'prods:clientId': '1665586625210-5',
                                    'prods:rowState': 'deleted',
                                    ...this.dataItemToDelete
                                }
                            ]
                        }
                    }
                };
                this.amat.deleteBe("TRESOFILTRE", body).subscribe((res: any) => {
                    this.notificationService.showSuccess('Bien supprimé');
                    const index = this.filteredData.findIndex((f) => f.codeFiltre == this.dataItemToDelete.codeFiltre);
                    if (index != -1) this.filteredData.splice(index, 1);
                    const indexFiltered = this.detailsFiltered.findIndex((f) => f.codeFiltre == this.dataItemToDelete.codeFiltre);
                    if (indexFiltered != -1) this.detailsFiltered.splice(index, 1);
                    this.selectedRow = [];
                    this.detailsFiltered = [];
                }, (error) => { this.handleCUDError(error); })
            }
        })
    }

    addHandler(event: any) {
        if (!this.detailsCrudMode) {
            this.crudMode = true;
            this.selectedRow = [];
            const { sender } = event;
            this.editDataModel = {};
            this.formGroup = createFormGroup({});
            this.formGroup?.controls['codeFiltre'].setAsyncValidators(this.amat.createFieldExistsValidator("TRESOFILTRE", "codeFiltre"))
            this.closeEditor(sender);
            sender.addRow(this.formGroup);
        } else {
            this.notificationService.showWarning("Modification critère de filtre en cours");
        }
    }

    filterTresoFiltre(event: any) {
        if (event.value == "ALL") this.filteredData = this.data;
        else this.filteredData = this.data.filter((d: any) => d.typeProvenance == event.value);
        this.selectedRow = [0];
        this.detailsFiltered = this.filtreDetails.filter((f: any) => f.codeFiltre == this.filteredData[0].codeFiltre);
    }

    onSelectionChange(event: any) {
        const item: TresoFiltre = event.selectedRows[0].dataItem;
        this.currentFilter = item;
        if (!this.crudMode && !this.detailsCrudMode && event.selectedRows[0].index != this.editedRowIndex) {
            this.detailsFiltered = this.filtreDetails.filter((f: any) => f.codeFiltre == item.codeFiltre);
            this.filteredchampAfiltrerData = this.champAfiltrerData.filter((c) => c.typeProvenance == item.typeProvenance);
            this.filteredchampAfiltrerData.sort((a, b) => (a.Libelle < b.Libelle ? -1 : 1));
            this.currentDetail = this.detailsFiltered[0];
            this.criteteSelectedRow = [0];
            this.toggleEgal(this.detailsFiltered[0]?.typeCritere);
            const tp = this.filteredchampAfiltrerData.find((t) => t.nomChamp == this.detailsFiltered[0]?.champFiltre);
            if (tp != null) this.showValueType(tp);
            this.patchDetailForm(this.detailsFiltered[0]);
        } else {
            this.notificationService.showWarning("Modification en cours");
            this.selectedRow = [this.editedRowIndex!];
        }
    }

    private closeEditor(grid: GridComponent, rowIndex: number = this.editedRowIndex!): void {
        grid.closeRow(rowIndex);
        this.editedRowIndex = undefined;
    }

    editDetailHandler() {
        if (!this.crudMode && this.detailsFiltered[0] != null) {
            this.detailsCrudMode = true;
            this.detailMode = "edit";
            this.criteteSelectedRow = [this.editedDetailRowIndex!];
            this.originalDetail = Object.assign({}, this.currentDetail);
            this.editDetailDataModel = this.currentDetail;
            console.log(this.logicalCharPredicate);
            console.log(this.intDecDatePredicate);
            this.patchDetailForm(this.originalDetail);
            this.detailFiltreForm.enable();
        } else if (!this.crudMode && this.detailsFiltered[0] == null) {
            this.notificationService.showWarning("Pas de critère à modifier");
        } else {
            this.notificationService.showWarning("Modification de filtre en cours");
        }
    }

    addDetailHandler() {
        if (!this.crudMode) {
            this.detailsCrudMode = true;
            this.detailMode = "add";
            this.editDataModel = new TresoFiltreDetail();
            this.detailFiltreForm.reset();
            this.detailFiltreForm.enable();
        } else {
            this.notificationService.showWarning("Modification de filtre en cours");
        }
    }

    removeDetailHandler() {
        this.detailToDelete = this.currentDetail;
        const dialog = this.dialogueService.showConfirmation(`Etes-vous sûr de vouloir supprimer ce critère de filtre ?`);
        dialog.result.subscribe((res: any) => {
            if (res.text = "Oui") {
                const body = {
                    dsTRESOFILTREDETAILS: {
                        'prods:hasChanges': true,
                        'prods:before': {
                            ttTRESOFILTREDETAILS: [
                                {
                                    'prods:clientId': '1665586625210-5',
                                    'prods:rowState': 'deleted',
                                    ...this.detailToDelete
                                }
                            ]
                        }
                    }
                };
                this.amat.deleteBe("TRESOFILTREDETAILS", body).subscribe((res: any) => {
                    console.log(res);
                    const indexFiltered = this.detailsFiltered.findIndex((d) => d.champFiltre == this.detailToDelete.champFiltre && d.valeur == this.detailToDelete.valeur);
                    if (indexFiltered != -1) this.detailsFiltered.splice(indexFiltered, 1);
                    const index = this.filtreDetails.findIndex((d) => d.champFiltre == this.detailToDelete.champFiltre && d.valeur == this.detailToDelete.valeur);
                    if (index != -1) this.filtreDetails.splice(index, 1);
                    this.detailFiltreForm.reset();
                    this.criteteSelectedRow = [];
                    this.notificationService.showSuccess('Bien supprimé');
                }, (error) => {
                    this.handleCUDError(error);
                })
            }
        })
    }

    saveDetailHandler() {
        const item: TresoFiltreDetail = new TresoFiltreDetail();
        item.setValues(this.editDetailDataModel);
        item.setValues(this.detailFiltreForm.value);
        item.setValues({ codeFiltre: this.currentFilter.codeFiltre });
        let transformedValeur = item.valeur;
        if (this.showInteger) transformedValeur = this.detailFiltreForm.value.intValeur;
        else if (this.showDate) transformedValeur = this.detailFiltreForm.value.dateValeur.toLocaleDateString('fr-FR', { year: 'numeric', month: '2-digit', day: '2-digit' });
        else transformedValeur = item.valeur;
        item.setValues({ valeur: transformedValeur });
        console.log(item);
        if (this.detailMode == "add") {
            const body = { dsTRESOFILTREDETAILS: { 'prods:hasChanges': true, ttTRESOFILTREDETAILS: [item] } };
            this.amat.postBe("TRESOFILTREDETAILS", body).subscribe((res: any) => {
                this.filtreDetails.push(res.dsTRESOFILTREDETAILS.ttTRESOFILTREDETAILS[0]);
                this.detailsFiltered.push(res.dsTRESOFILTREDETAILS.ttTRESOFILTREDETAILS[0]);
                this.detailFiltreForm.reset();
                this.criteteSelectedRow = [];
                this.notificationService.showSuccess('Bien enregistré');
            }, (error) => {
                this.handleCUDError(error);
                this.detailFiltreForm.reset();
            })
        } else {
            const body = {
                dsTRESOFILTREDETAILS: {
                    'prods:hasChanges': true,
                    ttTRESOFILTREDETAILS: [item],
                    'prods:before': {
                        ttTRESOFILTREDETAILS: [
                            this.originalDetail
                        ]
                    }
                }
            };
            this.amat.putBe("TRESOFILTREDETAILS", body).subscribe((res: any) => {
                const result = res.dsTRESOFILTREDETAILS.ttTRESOFILTREDETAILS[0];
                const index = this.detailsFiltered.findIndex((d) => d.idROWID == result.idROWID);
                if (index != -1) this.detailsFiltered[index] = result;
                const indexFiltered = this.filtreDetails.findIndex((d) => d.idROWID == result.idROWID);
                if (indexFiltered != -1) this.filtreDetails[index] = result;
                this.notificationService.showSuccess('Bien enregistré');
            }, (error) => { this.handleCUDError(error); })
        }
        this.detailFiltreForm.disable();
        this.detailsCrudMode = false;
    }

    cancelDetail() {
        this.detailsCrudMode = false;
        this.detailFiltreForm.disable();
        this.patchDetailForm(this.originalDetail);
    }

    getChampFiltreLibelle(nomChamp: string): string {
        const found = this.champAfiltrerData.find((c) => c.nomChamp == nomChamp && c.typeProvenance == this.currentFilter.typeProvenance);
        if (found != null) return found.Libelle;
        else return "";
    }

    private resfreshToAll() {
        this.filteredData = this.data;
        this.selectedFiltre = this.typeProvenanceData[0];
    }

    onCritereSelectionChange(event: any) {
        const item: TresoFiltreDetail = event.selectedRows[0].dataItem;
        this.toggleEgal(item.typeCritere);
        const tp = this.filteredchampAfiltrerData.find((t) => t.nomChamp == item.champFiltre);
        if (tp != null) this.showValueType(tp);
        this.patchDetailForm(item);
        this.currentDetail = item;
        this.editedDetailRowIndex = event.selectedRows[0].index;
    }

    onChampFiltreChange(event: TypeProvenance) {
        this.currentTypeProvenance = event;
        this.showValueType(event);
        this.detailFiltreForm.get("typeCritere")?.setValue(undefined);
    }

    onTypeCritereChange(event: any) {
        const tpVal = event.value;
        this.toggleEgal(tpVal);
        this.showValueType(this.currentTypeProvenance!);
        this.checkPredicates(tpVal, this.currentTypeProvenance);
    }

    private checkPredicates(tpVal: string, currentTypeProvenance: TypeProvenance | undefined) {
        this.logicalCharPredicate = (currentTypeProvenance?.typeDonnee == "logical" || currentTypeProvenance?.typeDonnee == "character") && (tpVal == "SUP" || tpVal == "INF" || tpVal == "SUPEGAL" || tpVal == "INFEGAL");
        this.intDecDatePredicate = (currentTypeProvenance?.typeDonnee == "integer" || currentTypeProvenance?.typeDonnee == "decimal" || currentTypeProvenance?.typeDonnee == "date" || currentTypeProvenance?.typeDonnee == "datetime") && (tpVal == "CONTIENT" || tpVal == "NOTCONT");
        if (this.logicalCharPredicate || this.intDecDatePredicate) {
            this.notificationService.showWarning("Ce type de condition est impossible pour ce champ");
        }
    }

    private patchDetailForm(item: TresoFiltreDetail) {
        if (item != null) {
            const obj = { champFiltre: item.champFiltre, typeCritere: item.typeCritere, valeur: item.valeur, intValeur: this.showInteger ? parseInt(item.valeur) : 0, dateValeur: this.showDate ? DateTime.fromFormat(item.valeur, 'dd/MM/yyyy').toJSDate() : undefined, position: item.position, longueur: item.longueur };
            this.detailFiltreForm.patchValue(obj);
            console.log(this.detailFiltreForm.value);
        } else {
            this.detailFiltreForm.reset();
        }
    }

    private showValueType(typeProvenance: TypeProvenance) {
        if (typeProvenance?.typeDonnee == "integer" || (typeProvenance?.typeDonnee == "decimal" && (typeProvenance?.nomChamp.toLocaleLowerCase().includes("frs") || typeProvenance?.nomChamp == "scompte"))) {
            this.showDate = false;
            this.showString = false;
            this.showInteger = true;
            this.valeurFormat = "#";
            this.detailFiltreForm.get("intValeur")?.addValidators(Validators.pattern('^[0-9]{15}$'));
        } else if (typeProvenance?.typeDonnee == "decimal" && (typeProvenance?.nomChamp.toLocaleLowerCase().includes("frs") || typeProvenance?.nomChamp == "scompte")) {
            this.showDate = false;
            this.showString = false;
            this.showInteger = true;
            this.valeurFormat = "#";
            this.detailFiltreForm.get("intValeur")?.addValidators(Validators.pattern('^[0-9]{12}$'));
        } else if (typeProvenance?.typeDonnee == "decimal") {
            this.showDate = false;
            this.showString = false;
            this.showInteger = true;
            this.valeurFormat = "n2";
            this.detailFiltreForm.get("intValeur")?.clearValidators();
        } else if (typeProvenance?.typeDonnee == "date" || typeProvenance?.typeDonnee == "datetime") {
            this.showDate = true;
            this.showString = false;
            this.showInteger = false;
            this.detailFiltreForm.get("intValeur")?.clearValidators();
        } else {
            this.showDate = false;
            this.showString = true;
            this.showInteger = false;
            this.detailFiltreForm.get("intValeur")?.clearValidators();
        }
    }

    private toggleEgal(typeCritere: string) {
        if (typeCritere == "EGAL") this.isEgal = true;
        else this.isEgal = false;
    }

    private handleReadError(error: any) {
        this.dialogueService.showError(this.amat.parseError(error));
    }

    private handleCUDError(myHttpErrorResponse: HttpErrorResponse) {
        this.dialogueService.showError(this.amat.parseError(myHttpErrorResponse));
    }

}


